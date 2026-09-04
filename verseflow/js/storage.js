// ==========================================================
// INDEXEDDB STORAGE HELPER FOR LOCAL MEDIA
// ==========================================================
window.VerseFlow = window.VerseFlow || {};

VerseFlow.openMediaDB = function() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('VerseFlowMediaDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

VerseFlow.generateThumbnail = function(file, maxWidth = 240, maxHeight = 135) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const tempUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(tempUrl);
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.75);
        };

        img.onerror = () => reject(new Error("Failed to load image for thumbnail generation."));
        img.src = tempUrl;
    });
};

VerseFlow.saveImageToDB = async function(file) {
    const db = await VerseFlow.openMediaDB();
    const id = 'idb_' + Date.now();
    const thumbBlob = await VerseFlow.generateThumbnail(file);
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        store.put({
            id,
            name: file.name,
            blob: file,
            thumbnail: thumbBlob,
            createdAt: Date.now()
        });
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => reject(tx.error);
    });
};

VerseFlow.getAllImagesFromDB = async function() {
    const db = await VerseFlow.openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
};

VerseFlow.getImageFromDB = async function(id) {
    const db = await VerseFlow.openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

VerseFlow.deleteImageFromDB = async function(id) {
    const db = await VerseFlow.openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

VerseFlow.resolveBackgroundUrl = async function(bgRef) {
    if (!bgRef) return '';
    if (bgRef.startsWith('idb_')) {
        const record = await VerseFlow.getImageFromDB(bgRef);
        if (record && record.blob) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(record.blob);
            });
        }
        return '';
    }
    return bgRef;
};