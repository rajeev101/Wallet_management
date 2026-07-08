import { useMemo, useState } from "react";
import { Icon } from "./VendorIcon";
import {
  createQrSvg,
  createVendorPaymentPayload,
  svgToDataUri,
} from "../utils/qrCode";

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

const createFileName = (vendor) => {
  const vendorId = vendor._id || vendor.id || vendor.email || "vendor";
  const safeName = `${vendor.name || "vendor"}-${vendorId}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${safeName || "vendor"}-payment-qr.svg`;
};

function VendorQrCodePage({ vendor = {} }) {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [isGenerated, setIsGenerated] = useState(false);
  const vendorId = vendor._id || vendor.id || vendor.email || "VEN001";
  const shopName = vendor.name || "Campus Cafe";
  const qrStatus =
    vendor.vendorStatus === "rejected" ? "Inactive" : isGenerated ? "Active" : "Ready";
  const payload = useMemo(
    () => createVendorPaymentPayload({ ...vendor, _id: vendorId, name: shopName }),
    [shopName, vendor, vendorId]
  );
  const qrSvg = useMemo(
    () =>
      createQrSvg(payload, {
        title: shopName,
        subtitle: `Vendor ID: ${vendorId}`,
        footer: "Campus Wallet payment QR",
        includeDetails: false,
      }),
    [payload, shopName, vendorId]
  );
  const qrPreview = useMemo(() => svgToDataUri(qrSvg), [qrSvg]);

  const handleGenerate = () => {
    setGeneratedAt(new Date());
    setIsGenerated(true);
  };

  const handleDownload = () => {
    if (!isGenerated) return;

    const downloadableSvg = createQrSvg(payload, {
      title: shopName,
      subtitle: `Vendor ID: ${vendorId}`,
      footer: `Generated: ${formatDateTime(generatedAt)}`,
      moduleSize: 10,
      includeDetails: true,
    });
    const blob = new Blob([downloadableSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = createFileName({ ...vendor, _id: vendorId, name: shopName });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="vendor-qr-management" aria-label="Vendor QR code management">
      <div className="vendor-qr-main-card">
        <h2>Your Payment QR Code</h2>
        <div className="vendor-qr-code-frame">
          {isGenerated ? (
            <img src={qrPreview} alt={`${shopName} payment QR code`} />
          ) : (
            <div className="vendor-qr-placeholder">
              <Icon type="qr" />
              <span>Generate QR</span>
            </div>
          )}
        </div>
        <p className="vendor-qr-caption">
          {isGenerated ? `Scan to pay ${shopName}` : `Create a payment QR for ${shopName}`}
        </p>
        <button
          className="vendor-download-button"
          type="button"
          onClick={handleDownload}
          disabled={!isGenerated}
        >
          <Icon type="download" />
          Download QR Code
        </button>
        <button className="vendor-generate-button" type="button" onClick={handleGenerate}>
          <Icon type="refresh" />
          Generate QR Code
        </button>
      </div>

      <div className="vendor-qr-side">
        <section className="vendor-qr-details-card">
          <h2>QR Code Details</h2>
          <dl>
            <div>
              <dt>Vendor ID</dt>
              <dd>{vendorId}</dd>
            </div>
            <div>
              <dt>Shop Name</dt>
              <dd>{shopName}</dd>
            </div>
            <div>
              <dt>QR Status</dt>
              <dd><span className="vendor-active-pill">{qrStatus}</span></dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{isGenerated ? formatDateTime(generatedAt) : "Not generated yet"}</dd>
            </div>
          </dl>
        </section>

        <section className="vendor-qr-help-card">
          <h2>How to use:</h2>
          <ol>
            <li>Display this QR code at your shop counter</li>
            <li>Students scan the code using Campus Wallet app</li>
            <li>They enter the amount and confirm payment</li>
            <li>You receive instant payment notification</li>
          </ol>
        </section>
      </div>
    </section>
  );
}

export default VendorQrCodePage;
