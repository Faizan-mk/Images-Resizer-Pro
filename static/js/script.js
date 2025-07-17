document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFile = document.getElementById('remove-file');
    const previewContainer = document.getElementById('preview-container');
    const preview = document.getElementById('preview');
    const previewDimensions = document.getElementById('preview-dimensions');
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    const maintainRatio = document.getElementById('maintain-ratio');
    const highQuality = document.getElementById('high-quality');
    const processBtn = document.getElementById('process-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultSection = document.getElementById('result');
    const resultImage = document.getElementById('result-image');
    const resultDimensions = document.getElementById('result-dimensions');
    const resultSize = document.getElementById('result-size');
    const resultTime = document.getElementById('result-time');
    const downloadBtn = document.getElementById('download-btn');
    const newImageBtn = document.getElementById('new-image-btn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    const spinner = document.getElementById('spinner');
    const buttonText = document.getElementById('button-text');

    let currentFile = null;
    let originalAspectRatio = 1;
    let startTime = 0;
    let systemStatus = null;

    // Initialize system status monitoring
    initializeSystemStatus();

    // Handle drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('dragover');
    }

    function unhighlight() {
        dropZone.classList.remove('dragover');
    }

    // Handle file drop
    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // Handle file input change
    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            handleFiles(this.files);
        }
    });

    // Handle files
    function handleFiles(files) {
        if (files.length > 0) {
            currentFile = files[0];
            
            // Show file info
            fileName.textContent = currentFile.name;
            fileSize.textContent = formatFileSize(currentFile.size);
            fileInfo.classList.remove('hidden');
            
            // Show preview
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                previewContainer.classList.remove('hidden');
                
                // Get image dimensions for aspect ratio
                const img = new Image();
                img.onload = function() {
                    originalAspectRatio = img.width / img.height;
                    previewDimensions.textContent = `${img.width} × ${img.height}`;
                    
                    // Auto-fill dimensions
                    if (maintainRatio.checked) {
                        widthInput.value = img.width;
                        heightInput.value = img.height;
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(currentFile);
            
            // Enable process button
            processBtn.disabled = false;
        }
    }

    // Remove file
    removeFile.addEventListener('click', function() {
        currentFile = null;
        fileInfo.classList.add('hidden');
        previewContainer.classList.add('hidden');
        resultSection.classList.add('hidden');
        processBtn.disabled = true;
        fileInput.value = '';
    });

    // Preset buttons
    document.querySelectorAll('.neon-preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const width = this.dataset.width;
            const height = this.dataset.height;
            widthInput.value = width;
            heightInput.value = height;
            
            // Highlight selected preset
            document.querySelectorAll('.neon-preset-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        });
    });

    // Maintain aspect ratio
    [widthInput, heightInput].forEach(input => {
        input.addEventListener('input', function() {
            if (maintainRatio.checked && currentFile) {
                if (this === widthInput && widthInput.value) {
                    heightInput.value = Math.round(widthInput.value / originalAspectRatio);
                } else if (this === heightInput && heightInput.value) {
                    widthInput.value = Math.round(heightInput.value * originalAspectRatio);
                }
            }
        });
    });

    // Process button click
    processBtn.addEventListener('click', async function() {
        if (!currentFile) {
            showToast('Please select an image first', 'error');
            return;
        }

        if (!widthInput.value && !heightInput.value) {
            showToast('Please specify width or height', 'error');
            return;
        }

        try {
            // Show loading state
            startTime = Date.now();
            spinner.classList.remove('hidden');
            buttonText.innerHTML = '<i class="fas fa-cog fa-spin mr-2"></i>Processing...';
            processBtn.disabled = true;
            progressContainer.classList.remove('hidden');

            // Show system status if available
            if (systemStatus) {
                showToast(`Processing with ${systemStatus.cpu_count} CPU cores`, 'info');
            }

            // Simulate progress with real-time updates
            simulateProgress();

            const formData = new FormData();
            formData.append('file', currentFile);
            if (widthInput.value) formData.append('width', widthInput.value);
            if (heightInput.value) formData.append('height', heightInput.value);

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process image');
            }

            // Use server-provided processing time
            const processingTime = data.processing_time || `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

            // Show result
            resultImage.src = data.url;
            resultDimensions.textContent = `${data.width} × ${data.height}`;
            resultSize.textContent = data.size;
            resultTime.textContent = processingTime;
            downloadBtn.href = data.url;
            resultSection.classList.remove('hidden');

            // Scroll to result
            resultSection.scrollIntoView({ behavior: 'smooth' });
            showToast(`Image processed in ${processingTime} using parallel processing!`, 'success');

        } catch (error) {
            console.error('Error:', error);
            showToast(error.message || 'Failed to process image', 'error');
        } finally {
            // Reset button state
            spinner.classList.add('hidden');
            buttonText.innerHTML = '<i class="fas fa-magic mr-2"></i>Resize Image';
            processBtn.disabled = false;
            progressContainer.classList.add('hidden');
        }
    });

    // New image button
    newImageBtn.addEventListener('click', function() {
        removeFile.click();
        showToast('Ready for new image', 'info');
    });

    // Initialize system status
    async function initializeSystemStatus() {
        try {
            const response = await fetch('/status');
            if (response.ok) {
                systemStatus = await response.json();
                console.log('System status:', systemStatus);
            }
        } catch (error) {
            console.log('Could not fetch system status');
        }
    }

    // Enhanced progress simulation with parallel processing indicators
    function simulateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 12; // Slightly faster due to parallel processing
            if (progress > 85) progress = 85;
            progressFill.style.width = progress + '%';
            
            if (progress < 25) {
                progressText.textContent = 'Validating image...';
            } else if (progress < 50) {
                progressText.textContent = 'Parallel processing...';
            } else if (progress < 75) {
                progressText.textContent = 'Optimizing quality...';
            } else if (progress < 85) {
                progressText.textContent = 'Finalizing...';
            }
            
            if (progress >= 85) {
                clearInterval(interval);
                progressFill.style.width = '100%';
                progressText.textContent = 'Complete!';
            }
        }, 150); // Faster updates due to parallel processing
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Show toast message
    function showToast(message, type = 'info') {
        toastMessage.textContent = message;
        
        // Update toast styling based on type
        toast.className = 'neon-toast';
        if (type === 'error') {
            toast.classList.add('border-red-500');
            toastIcon.className = 'fas fa-exclamation-triangle w-6 h-6 mr-3';
        } else if (type === 'success') {
            toast.classList.add('border-green-500');
            toastIcon.className = 'fas fa-check-circle w-6 h-6 mr-3';
        } else {
            toast.classList.add('border-blue-500');
            toastIcon.className = 'fas fa-info-circle w-6 h-6 mr-3';
        }
        
        toast.classList.remove('hidden');
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
});
