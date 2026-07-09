import { Icon } from "./VendorIcon";

function VendorQrCodePage({ vendor }) {
  const vendorId = vendor?.id || vendor?._id || "";
  const qrUrl = vendorId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${vendorId}`
    : "";

  return (
    <section className="vendor-qr-management" aria-label="Vendor QR code management">
      <div className="vendor-qr-main-card">
        <h2>Your Payment QR Code</h2>
        <div className="vendor-qr-code-frame" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "220px", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1", padding: "16px" }}>
          {qrUrl ? (
            <img src={qrUrl} alt="Vendor Payment QR Code" style={{ width: "200px", height: "200px" }} />
          ) : (
            <div style={{ color: "#64748b" }}>Loading QR Code...</div>
          )}
        </div>
        <button 
          className="vendor-download-button" 
          type="button"
          onClick={() => {
            if (qrUrl) window.open(qrUrl, "_blank");
          }}
        >
          <Icon type="download" />
          Download QR Code
        </button>
      </div>

      <div className="vendor-qr-side">
        <section className="vendor-qr-details-card">
          <h2>QR Code Details</h2>
          <dl>
            <div>
              <dt>Vendor ID</dt>
              <dd style={{ fontSize: "12px", wordBreak: "break-all" }}>{vendorId || "Loading..."}</dd>
            </div>
            <div>
              <dt>Shop Name</dt>
              <dd>{vendor?.name || "Loading..."}</dd>
            </div>
            <div>
              <dt>QR Status</dt>
              <dd><span className="vendor-active-pill">Active & Permanent</span></dd>
            </div>
          </dl>
        </section>

        <section className="vendor-qr-help-card">
          <h2>How to use:</h2>
          <ol>
            <li>Display this static QR code at your shop counter</li>
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

