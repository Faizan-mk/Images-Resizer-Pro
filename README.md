

 Image Resizer Pro

A fast and modern image resizer web app** built with **Flask**, featuring **parallel processing**, drag-and-drop UI, live preview, and neon-cyberpunk vibes.


## 🚀 Features

* 🖼️ Upload and resize images (JPG, PNG, GIF)
* ⚡ Fast performance using **multithreading** and **multiprocessing**
* 📏 Auto aspect-ratio lock or custom dimensions
* 💻 Stylish **neon-themed UI**
* 📉 Optimized file sizes with quality control
* 🔄 Drag & drop, live preview, toast notifications
* 🧠 Smart system resource usage based on available CPU cores

---

## 🧰 Tech Stack

* **Backend:** Python, Flask, Pillow (PIL)
* **Frontend:** HTML5, JavaScript, CSS3
* **Styling:** Custom CSS with cyberpunk effects and responsive design
* **Concurrency:** `ThreadPoolExecutor`, `ProcessPoolExecutor`, `Queue`

---

## 🖥️ How to Run

### 1. Clone the repo

```bash
git clone https://github.com/your-username/image-resizer-pro.git
cd image-resizer-pro
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> Make sure you have Python 3.10+ installed.

### 3. Run the app

```bash
python app.py
```

Visit `http://localhost:5000` in your browser.

---

## 📁 File Structure

```
image-resizer-pro/
│
├── app.py              # Main Flask app
├── static/
│   ├── style.css       # Neon-themed styles
│   └── script.js       # Interactive frontend logic
├── templates/
│   └── index.html      # Main UI template
├── uploads/            # Uploaded images (auto-cleaned)
├── processed/          # Resized output (auto-cleaned)
└── requirements.txt    # Python dependencies
```

---

## 🛠️ Customization Tips

* 🔧 You can change `MAX_CONTENT_LENGTH`, thread/process pool sizes in `app.py`.
* ⏳ File auto-cleanup runs every 30 mins by default. Adjust in `cleanup_old_files_async()`.
* 💅 You can tweak color themes in `style.css`.

---

