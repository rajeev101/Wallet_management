import { useEffect, useState, useRef } from "react";
import { Icon } from "./StudentIcon";
import StudentHeader from "./StudentHeader";
import { getVendorById, makePayment } from "../api/auth";
import { Html5Qrcode } from "html5-qrcode";

function StudentScanPayPage({ student, refreshProfile, onLogout }) {
  const [qrScanned, setQrScanned] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [activeVendor, setActiveVendor] = useState(null);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState("prompt");

  const qrCodeScannerRef = useRef(null);
  const scannerStartingRef = useRef(false);
  const scanHandledRef = useRef(false);

  const handleFetchVendor = async (idToFetch) => {
    if (!idToFetch || idToFetch.trim().length !== 24) {
      setStatus("Invalid vendor QR code.");
      return;
    }

    setStatus("");
    setIsSubmitting(true);
    const token = sessionStorage.getItem("cpacToken");

    try {
      const res = await getVendorById(idToFetch.trim(), token);
      if (res.success && res.vendor) {
        setActiveVendor(res.vendor);
        setQrScanned(true);
        setStatus("");
      } else {
        setStatus(res.message || "Vendor not found.");
      }
    } catch (err) {
      setStatus(err.message || "Error fetching vendor details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectCameraId = async () => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) return null;

      const preferred = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
      return (preferred || cameras[0]).id;
    } catch (err) {
      console.warn("Failed to list cameras, falling back to environment constraints:", err);
      return null;
    }
  };

  const startCamera = async () => {
    if (cameraActive || scannerStartingRef.current) return;
    scannerStartingRef.current = true;
    scanHandledRef.current = false;
    setStatus("");
    setCameraActive(true);
  };

  const stopCamera = () => {
    scannerStartingRef.current = false;
    setCameraActive(false);
  };

  useEffect(() => {
    if (!qrScanned) {
      const timer = setTimeout(() => {
        if (scannerStartingRef.current) return;
        scannerStartingRef.current = true;
        scanHandledRef.current = false;
        setStatus("");
        setCameraActive(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [qrScanned]);

  useEffect(() => {
    let cancelled = false;
    let html5QrCode = null;
    let startupPromise = null;
    let cleanupPromise = null;

    const cleanupScanner = () => {
      if (cleanupPromise) return cleanupPromise;
      cleanupPromise = (async () => {
        if (!html5QrCode) return;
        if (startupPromise) {
          try {
            await startupPromise;
          } catch {
            // Startup failure is surfaced by initCamera; cleanup still follows.
          }
        }
        try {
          if (html5QrCode.isScanning) await html5QrCode.stop();
        } catch (err) {
          console.warn("Failed to stop QR scanner:", err);
        }
        try {
          if (typeof html5QrCode.clear === "function") await html5QrCode.clear();
        } catch (err) {
          console.warn("Failed to clear QR scanner:", err);
        }
        if (qrCodeScannerRef.current === html5QrCode) {
          qrCodeScannerRef.current = null;
        }
      })();
      return cleanupPromise;
    };

    const initCamera = async () => {
      if (cameraActive && !qrScanned) {
        try {
          const element = document.getElementById("qr-reader");
          if (!element) {
            throw new Error("Scanner is unavailable. Close and reopen Scan to Pay.");
          }

          if (qrCodeScannerRef.current) {
            return;
          }

          const cameraId = await selectCameraId();
          if (cancelled) return;

          html5QrCode = new Html5Qrcode("qr-reader");
          qrCodeScannerRef.current = html5QrCode;
          const cameraFacingOrId = cameraId || { facingMode: "environment" };

          startupPromise = html5QrCode.start(
            cameraFacingOrId,
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              }
            },
            async (decodedText) => {
              if (scanHandledRef.current || cancelled) return;
              scanHandledRef.current = true;
              scannerStartingRef.current = false;
              setCameraActive(false);
              void handleFetchVendor(decodedText);
            },
            () => {
              // ignore scan errors
            }
          );
          await startupPromise;

          if (cancelled) {
            await cleanupScanner();
            return;
          }
          setCameraPermission("granted");
          scannerStartingRef.current = false;
        } catch (err) {
          if (!cancelled) {
            console.error("Error starting camera:", err);
            const errorText = `${err?.name || ""} ${err?.message || err || ""}`;
            const permissionFailure = ["NotAllowedError", "PermissionDeniedError", "SecurityError"]
              .includes(err?.name) || /permission|notallowed|secure context/i.test(errorText);
            setCameraPermission(permissionFailure ? "denied" : "prompt");
            setStatus(permissionFailure
              ? "Camera access was blocked. Allow camera access in Chrome and use a secure HTTPS connection, then retry."
              : err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError"
                ? "No camera was found. Connect or enable a camera, then retry."
                : err?.message || (typeof err === "string" ? err : "Could not start the camera. Check camera access and retry."));
            setCameraActive(false);
          }
          scannerStartingRef.current = false;
          await cleanupScanner();
        }
      }
    };

    void initCamera();

    return () => {
      cancelled = true;
      scannerStartingRef.current = false;
      void cleanupScanner();
    };
  }, [cameraActive, qrScanned]);

  const handlePay = async () => {
    if (!activeVendor) {
      setStatus("No vendor selected.");
      return;
    }

    const amount = Number(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setStatus("Please enter a valid positive amount.");
      return;
    }

    if (amount > (student?.walletBalance || 0)) {
      setStatus("Insufficient wallet balance.");
      return;
    }

    setStatus("");
    setIsSubmitting(true);
    setIsProcessing(true);

    const startTime = Date.now();

    try {
      const token = sessionStorage.getItem("cpacToken");
      const res = await makePayment(
        {
          vendorId: activeVendor._id,
          amount,
          description: `Paid ₹${amount.toFixed(2)} to ${activeVendor.name}`,
        },
        token
      );

      if (res.success) {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 3000 - elapsedTime);

        setTimeout(() => {
          setIsProcessing(false);
          setIsPaymentSuccess(true);
          setStatus("");
          setPaymentAmount("");
          setIsSubmitting(false);
          if (refreshProfile) {
            refreshProfile();
          }
        }, remainingTime);
      } else {
        setIsProcessing(false);
        setIsSubmitting(false);
        setStatus(res.message || "Payment failed.");
      }
    } catch (err) {
      setIsProcessing(false);
      setIsSubmitting(false);
      setStatus(err.message || "Error processing payment.");
    }
  };

  return (
    <section className="scan-pay-view" aria-label="Scan to pay">
        {!qrScanned ? (
        <div className="scanner-card">
          <div className="scanner-window" style={{ background: "#f8fafc", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "360px", position: "relative", width: "100%" }}>
            {/* Continuously mounted so html5-qrcode can target it on startCamera */}
            <div style={{ width: "100%", display: cameraActive ? "flex" : "none", flexDirection: "column", alignItems: "center", position: "relative" }}>
              <button
                type="button"
                aria-label="Close camera"
                onClick={stopCamera}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  zIndex: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "14px",
                  boxShadow: "0 8px 20px rgba(220, 38, 38, 0.24)",
                  backdropFilter: "blur(6px)"
                }}
              >
                <span aria-hidden="true" style={{ fontSize: "16px", lineHeight: 1 }}>✕</span>
                <span>Close</span>
              </button>
              <div id="qr-reader" style={{ width: "100%", maxWidth: "400px", borderRadius: "10px", overflow: "hidden", minHeight: "280px" }}></div>
            </div>

            {!cameraActive && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <Icon type="qr" />
                <h3 style={{ margin: "15px 0 5px 0" }}>Scan Static Vendor QR</h3>
                {cameraPermission === "denied" ? (
                  <p style={{ fontSize: "14px", color: "#e53e3e", fontWeight: "500", margin: "10px 0" }}>
                    Camera access is required to scan QR codes.
                  </p>
                ) : (
                  <p style={{ fontSize: "14px", color: "#64748b", margin: "5px 0 15px 0" }}>
                    Camera stream is stopped or unavailable.
                  </p>
                )}
                <button
                  type="button"
                  onClick={startCamera}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "6px",
                    background: "#7c3aed",
                    color: "white",
                    border: "none",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  {cameraPermission === "denied" ? "Retry Camera" : "Open Camera"}
                </button>
              </div>
            )}
          </div>

          {status && (
            <p style={{ color: "#e53e3e", fontWeight: "bold", textAlign: "center", marginTop: "10px" }}>
              {status}
            </p>
          )}
        </div>
        ) : (
        <div className="payment-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {isPaymentSuccess ? (
            <div className="success-container">
              <div className="success-icon-circle">
                ✓
              </div>
              <h2 className="success-title">Payment completed successfully!</h2>
              <p className="success-subtitle">Your transaction has been processed successfully.</p>
              <button
                type="button"
                onClick={() => {
                  setIsPaymentSuccess(false);
                  setQrScanned(false);
                  setActiveVendor(null);
                  setPaymentAmount("");
                  setStatus("");
                }}
                className="pay-now-button"
                style={{ marginTop: "28px", width: "auto", padding: "12px 32px" }}
              >
                Done
              </button>
            </div>
          ) : isProcessing ? (
            <div className="processing-container">
              <div className="processing-spinner"></div>
              <h2 className="processing-title">Processing Payment...</h2>
              <p className="processing-subtitle">Please wait while we securely process your transaction.</p>
            </div>
          ) : (
            <>
              <h2>Enter Amount</h2>

              <div style={{ marginBottom: "15px", padding: "12px", background: "#f7fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ color: "#718096" }}>Paying to:</span>
                  <strong>{activeVendor?.name}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#718096" }}>Email/Contact:</span>
                  <span style={{ fontSize: "14px" }}>{activeVendor?.email}</span>
                </div>
              </div>

              <label htmlFor="paymentAmount" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                Payment Amount
              </label>
              <div className="amount-field">
                <span>₹</span>
                <input
                  id="paymentAmount"
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="vendor-summary">
                <span>Your Balance</span>
                <strong className="balance-value">₹{Number(student?.walletBalance || 0).toFixed(2)}</strong>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setQrScanned(false);
                    setActiveVendor(null);
                    setPaymentAmount("");
                    setStatus("");
                  }}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#edf2f7",
                    color: "#4a5568",
                    border: "none",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  className="pay-now-button"
                  type="button"
                  onClick={handlePay}
                  disabled={isSubmitting || isProcessing}
                  style={{ flex: 2, margin: 0 }}
                >
                  {isProcessing || isSubmitting ? "Processing Payment..." : "Confirm & Pay"}
                </button>
              </div>

              {status && (
                <p
                  style={{
                    marginTop: "15px",
                    textAlign: "center",
                    fontWeight: "bold",
                    color: "#e53e3e"
                  }}
                >
                  {status}
                </p>
              )}
            </>
          )}
        </div>
        )}
      </section>
  );
}

export default StudentScanPayPage;


