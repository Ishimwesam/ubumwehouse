import React, { useEffect, useRef, useState } from 'react';

const receiptAccept = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';

const ReceiptCaptureInput = ({
  file,
  onFileSelected,
  inputStyle,
  disabled = false
}) => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [startingCamera, setStartingCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fallbackCaptureRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play?.().catch(() => {});
  }, [cameraOpen]);

  const handleFileChange = (event) => {
    onFileSelected(event.target.files?.[0] || null);
    event.target.value = '';
  };

  const openCamera = async () => {
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackCaptureRef.current?.click();
      return;
    }

    try {
      setStartingCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1600 },
          height: { ideal: 1200 }
        },
        audio: false
      });

      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      setCameraError('Camera could not open. Choose a file or allow camera access in the browser.');
      fallbackCaptureRef.current?.click();
    } finally {
      setStartingCamera(false);
    }
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Could not capture the photo. Try again or choose a file.');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const receiptFile = new File([blob], `receipt-${timestamp}.jpg`, {
        type: 'image/jpeg'
      });
      onFileSelected(receiptFile);
      closeCamera();
    }, 'image/jpeg', 0.9);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.controls}>
        <input
          type="file"
          accept={receiptAccept}
          onChange={handleFileChange}
          disabled={disabled}
          style={{ ...styles.fileInput, ...inputStyle }}
        />
        <button
          type="button"
          onClick={openCamera}
          disabled={disabled || startingCamera}
          style={{
            ...styles.cameraButton,
            ...(disabled || startingCamera ? styles.disabledButton : null)
          }}
        >
          {startingCamera ? 'Opening camera...' : 'Take Photo'}
        </button>
        <input
          ref={fallbackCaptureRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          disabled={disabled}
          style={styles.hiddenFileInput}
        />
      </div>

      {file?.name ? <div style={styles.fileName}>{file.name}</div> : null}
      {cameraError ? <div style={styles.error}>{cameraError}</div> : null}

      {cameraOpen ? (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Take receipt photo">
          <div style={styles.cameraPanel}>
            <video ref={videoRef} playsInline muted style={styles.video} />
            <div style={styles.cameraActions}>
              <button type="button" onClick={capturePhoto} style={styles.captureButton}>
                Capture
              </button>
              <button type="button" onClick={closeCamera} style={styles.closeButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  fileInput: {
    flex: '1 1 220px',
    minWidth: 0
  },
  cameraButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 0.95rem',
    borderRadius: '0.5rem',
    border: '1px solid #99f6e4',
    backgroundColor: '#f0fdfa',
    color: '#0f766e',
    fontWeight: 800,
    cursor: 'pointer'
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  hiddenFileInput: {
    display: 'none'
  },
  fileName: {
    fontSize: '0.85rem',
    color: '#475569',
    wordBreak: 'break-word'
  },
  error: {
    fontSize: '0.85rem',
    color: '#b91c1c'
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 42, 0.78)'
  },
  cameraPanel: {
    width: 'min(680px, 100%)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    background: '#ffffff',
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.35)'
  },
  video: {
    display: 'block',
    width: '100%',
    aspectRatio: '4 / 3',
    objectFit: 'cover',
    background: '#111827'
  },
  cameraActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '0.9rem'
  },
  captureButton: {
    minHeight: '40px',
    padding: '0 1rem',
    border: '0',
    borderRadius: '0.5rem',
    background: '#0f766e',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer'
  },
  closeButton: {
    minHeight: '40px',
    padding: '0 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 800,
    cursor: 'pointer'
  }
};

export default ReceiptCaptureInput;
