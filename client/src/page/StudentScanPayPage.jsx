import { useEffect, useRef, useState } from "react";
import { createPayment } from "../api/auth";
import { Icon } from "./StudentIcon";

const getVendorFromQr = (value) => {
  try {
    const payload = new URL(value);
    const isPaymentQr = payload.protocol === "campuswallet:" && payload.hostname === "pay";

    if (!isPaymentQr) return null;

    return {
      id: payload.searchParams.get("vendorId") || "vendor",
      name: payload.searchParams.get("name") || "Campus Vendor",
    };
  } catch {
    return null;
  }
};

function StudentScanPayPage({ student, refreshProfile }) {
  const [qrScanned, setQrScanned] = useState(false);
  const [scanStatus, setScanStatus] = useState("idle");
  const [scanMessage, setScanMessage] = useState("Tap the scanner to open camera");
  const [scannedVendor, setScannedVendor] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const detectorRef = useRef(null);

  const stopScanner = () => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(
    () => () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const handleStopScanner = () => {
    stopScanner();
    setScanStatus("idle");
    setScanMessage("Tap the scanner to open camera");
  };

  const scanFrame = async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;

    if (!video || !detector || !streamRef.current) return;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const barcodes = await detector.detect(video);
        const vendor = barcodes.map((barcode) => getVendorFromQr(barcode.rawValue)).find(Boolean);

        if (vendor) {
          setScannedVendor(vendor);
          setQrScanned(true);
          setScanStatus("scanned");
          setScanMessage("QR code scanned successfully");
          stopScanner();
          return;
        }
      } catch {
        setScanStatus("error");
        setScanMessage("Unable to read the camera feed. Please try again.");
        stopScanner();
        return;
      }
    }

    frameRef.current = window.requestAnimationFrame(scanFrame);
  };

  const startScanner = async () => {
    if (scanStatus === "starting" || scanStatus === "scanning") return;

    setQrScanned(false);
    setScannedVendor(null);
    setPaymentAmount("");
    setPaymentMessage("");
    setPaymentError("");
    setScanStatus("starting");
    setScanMessage("Requesting camera permission...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;

      if (!("BarcodeDetector" in window)) {
        setScanStatus("error");
        setScanMessage("QR scanning is not supported in this browser.");
        stopScanner();
        return;
      }

      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScanStatus("scanning");
      setScanMessage("Point camera at vendor QR code");
      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (error) {
      const permissionDenied =
        error.name === "NotAllowedError" || error.name === "PermissionDeniedError";

      setScanStatus("error");
      setScanMessage(
        permissionDenied
          ? "Camera permission was denied. Allow camera access to scan a vendor QR code."
          : "Unable to open camera. Please check your device camera and try again."
      );
      stopScanner();
    }
  };

  const handlePayment = async () => {
    const token = localStorage.getItem("cpacToken");
    const amount = Number(paymentAmount);

    setPaymentMessage("");
    setPaymentError("");

    if (!token) {
      setPaymentError("Please login again to complete payment.");
      return;
    }

    if (!scannedVendor?.id) {
      setPaymentError("Scan a valid vendor QR code first.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }

    if (amount > Number(student?.walletBalance || 0)) {
      setPaymentError("Insufficient wallet balance.");
      return;
    }

    setIsPaying(true);

    try {
      const data = await createPayment({ vendorId: scannedVendor.id, amount }, token);
      const safeUser = { ...(data.student || {}) };
      delete safeUser.password;

      if (safeUser._id) {
        localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      }

      setPaymentMessage(`Payment of $${amount.toFixed(2)} sent to ${scannedVendor.name}.`);
      setPaymentAmount("");
      refreshProfile?.();
    } catch (paymentFailure) {
      setPaymentError(paymentFailure.message);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <section className="scan-pay-view" aria-label="Scan to pay">
      <div className="scanner-card">
        <button
          className={`scanner-window scanner-window-${scanStatus}`}
          type="button"
          onClick={startScanner}
          disabled={scanStatus === "starting" || scanStatus === "scanning"}
        >
          {(scanStatus === "starting" || scanStatus === "scanning") && (
            <video
              ref={videoRef}
              className="scanner-video"
              muted
              playsInline
              aria-label="Camera preview for QR scan"
            />
          )}
          {scanStatus !== "starting" && scanStatus !== "scanning" && <Icon type="qr" />}
          <span>{scanStatus === "idle" ? "Scan vendor QR code" : scanMessage}</span>
        </button>
        <p>{scanMessage}</p>
        {(scanStatus === "starting" || scanStatus === "scanning") && (
          <button className="scanner-stop-button" type="button" onClick={handleStopScanner}>
            Stop Camera
          </button>
        )}
        <div className="scan-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      {qrScanned && (
        <div className="payment-card">
          <h2>Enter Amount</h2>
          <label htmlFor="paymentAmount">Payment Amount</label>
          <div className="amount-field">
            <span>$</span>
            <input
              id="paymentAmount"
              min="0"
              step="0.01"
              type="number"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
            />
          </div>
          <div className="vendor-summary">
            <span>Vendor</span>
            <strong>{scannedVendor?.name || "Campus Vendor"}</strong>
            <span>Your Balance</span>
            <strong className="balance-value">${Number(student?.walletBalance || 0).toFixed(2)}</strong>
          </div>
          {paymentError && <p className="payment-status error">{paymentError}</p>}
          {paymentMessage && <p className="payment-status success">{paymentMessage}</p>}
          <button className="pay-now-button" type="button" onClick={handlePayment} disabled={isPaying}>
            {isPaying ? "Paying..." : "Pay Now"}
          </button>
        </div>
      )}
    </section>
  );
}

export default StudentScanPayPage;
