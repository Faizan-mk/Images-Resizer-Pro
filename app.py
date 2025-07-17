import os
import time
import threading
import multiprocessing
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from queue import Queue
from flask import Flask, request, jsonify, send_from_directory, url_for, render_template
from PIL import Image
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Parallel processing configuration
MAX_WORKERS = multiprocessing.cpu_count()
THREAD_POOL_SIZE = 10
PROCESS_POOL_SIZE = min(4, MAX_WORKERS)

# Global thread and process pools
thread_pool = ThreadPoolExecutor(max_workers=THREAD_POOL_SIZE)
process_pool = ProcessPoolExecutor(max_workers=PROCESS_POOL_SIZE)

# Task queue for background processing
task_queue = Queue()

# Ensure upload and processed folders exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'gif'}

def process_image_parallel(args):
    """
    Parallel image processing function that can be run in separate processes
    """
    try:
        filepath, width, height, processed_path, ext = args
        
        with Image.open(filepath) as img:
            original_width, original_height = img.size
            
            # Calculate new dimensions maintaining aspect ratio
            if width and height:
                new_width = width
                new_height = height
            elif width:
                ratio = width / original_width
                new_width = width
                new_height = int(original_height * ratio)
            elif height:
                ratio = height / original_height
                new_width = int(original_width * ratio)
                new_height = height
            else:
                raise ValueError("No dimensions provided")
            
            # Resize the image with high-quality resampling
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save in the same format as the original with proper parameters
            if ext in ['jpg', 'jpeg']:
                img.save(processed_path, optimize=True, quality=95)
            else:
                img.save(processed_path, optimize=True)
            
            # Get file size
            file_size = os.path.getsize(processed_path) / 1024  # Size in KB
            
            return {
                'success': True,
                'width': new_width,
                'height': new_height,
                'size': f"{file_size:.1f} KB",
                'file_size_bytes': file_size
            }
            
    except Exception as e:
        logger.error(f"Error in parallel processing: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def cleanup_file_async(filepath):
    """
    Asynchronous file cleanup function
    """
    def cleanup():
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"Cleaned up file: {filepath}")
        except Exception as e:
            logger.error(f"Error cleaning up file {filepath}: {str(e)}")
    
    # Run cleanup in thread pool
    thread_pool.submit(cleanup)

def validate_image_async(filepath):
    """
    Asynchronous image validation
    """
    def validate():
        try:
            with Image.open(filepath) as img:
                return {
                    'valid': True,
                    'width': img.size[0],
                    'height': img.size[1],
                    'format': img.format,
                    'mode': img.mode
                }
        except Exception as e:
            return {
                'valid': False,
                'error': str(e)
            }
    
    return thread_pool.submit(validate)

def optimize_image_quality_async(processed_path, ext):
    """
    Asynchronous image quality optimization
    """
    def optimize():
        try:
            with Image.open(processed_path) as img:
                # Additional optimization for different formats
                if ext in ['jpg', 'jpeg']:
                    # Progressive JPEG for better web loading
                    img.save(processed_path, optimize=True, quality=95, progressive=True)
                elif ext == 'png':
                    # PNG optimization
                    img.save(processed_path, optimize=True, compress_level=9)
                elif ext == 'gif':
                    # GIF optimization
                    img.save(processed_path, optimize=True)
                
                logger.info(f"Optimized image: {processed_path}")
        except Exception as e:
            logger.error(f"Error optimizing image {processed_path}: {str(e)}")
    
    thread_pool.submit(optimize)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    start_time = time.time()
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '' or file.filename is None:
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Please upload a PNG, JPG, or GIF image.'}), 400
    
    # Get width and height from form data
    width = request.form.get('width', type=int)
    height = request.form.get('height', type=int)
    
    if not width and not height:
        return jsonify({'error': 'Please specify width or height'}), 400
    
    filepath = None
    try:
        # Generate a unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Save file asynchronously
        file.save(filepath)
        
        # Validate image asynchronously
        validation_future = validate_image_async(filepath)
        validation_result = validation_future.result(timeout=10)
        
        if not validation_result['valid']:
            raise Exception(f"Invalid image: {validation_result['error']}")
        
        # Process the image using parallel processing
        processed_filename = f"resized_{filename}"
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)
        
        # Use process pool for CPU-intensive image processing
        process_args = (filepath, width, height, processed_path, ext)
        future = process_pool.submit(process_image_parallel, process_args)
        
        # Wait for processing to complete with timeout
        result = future.result(timeout=30)
        
        if not result['success']:
            raise Exception(result['error'])
        
        # Optimize image quality asynchronously (non-blocking)
        optimize_image_quality_async(processed_path, ext)
        
        # Schedule cleanup of original file asynchronously
        cleanup_file_async(filepath)
        
        # Calculate total processing time
        total_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'original': file.filename,
            'filename': processed_filename,
            'width': result['width'],
            'height': result['height'],
            'size': result['size'],
            'processing_time': f"{total_time:.2f}s",
            'url': url_for('get_processed_file', filename=processed_filename)
        })
        
    except Exception as e:
        # Clean up the uploaded file if there was an error
        if filepath and os.path.exists(filepath):
            cleanup_file_async(filepath)
        
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({'error': f'Failed to process image: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/processed/<filename>')
def get_processed_file(filename):
    return send_from_directory(app.config['PROCESSED_FOLDER'], filename, as_attachment=True)

@app.route('/status')
def get_status():
    """
    Endpoint to check system status and processing statistics
    """
    return jsonify({
        'status': 'running',
        'cpu_count': MAX_WORKERS,
        'thread_pool_size': THREAD_POOL_SIZE,
        'process_pool_size': PROCESS_POOL_SIZE,
        'queue_size': task_queue.qsize()
    })

def cleanup_old_files_async():
    """
    Asynchronous cleanup of old files
    """
    def cleanup():
        try:
            import glob
            current_time = time.time()
            max_age = 3600  # 1 hour
            
            for folder in [app.config['UPLOAD_FOLDER'], app.config['PROCESSED_FOLDER']]:
                for filepath in glob.glob(os.path.join(folder, '*')):
                    if os.path.getmtime(filepath) < current_time - max_age:
                        try:
                            os.remove(filepath)
                            logger.info(f"Cleaned up old file: {filepath}")
                        except:
                            pass
        except Exception as e:
            logger.error(f"Error in cleanup: {str(e)}")
    
    # Run cleanup every 30 minutes
    def schedule_cleanup():
        while True:
            time.sleep(1800)  # 30 minutes
            thread_pool.submit(cleanup)
    
    cleanup_thread = threading.Thread(target=schedule_cleanup, daemon=True)
    cleanup_thread.start()

if __name__ == '__main__':
    # Start background cleanup
    cleanup_old_files_async()
    
    logger.info(f"Starting server with {MAX_WORKERS} CPU cores")
    logger.info(f"Thread pool size: {THREAD_POOL_SIZE}")
    logger.info(f"Process pool size: {PROCESS_POOL_SIZE}")
    
    app.run(debug=True, host='0.0.0.0')
