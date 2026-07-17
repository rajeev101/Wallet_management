import { useCallback, useEffect, useRef, useState } from "react";
import {
  approveVendor,
  getAdminStats,
  getAdminStudents,
  getAdminTransactions,
  getAdminVendors,
  rejectVendor,
  getAdminWalletRequests,
  updateWalletRequestStatus,
  getNotifications,
  clearNotifications,
} from "../api/admin";
import { getProfile, updateProfile } from "../api/auth";

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const formatMoney = (value) => `₹${formatNumber(Math.round(Number(value || 0)))}`;
const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
const escapeSpreadsheetCell = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const getDateStamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const sanitizeFileNamePart = (value) => String(value || "Student").trim().replace(/[^a-z0-9_-]+/gi, "_");
const getCrcTable = () => {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
};
const crcTable = getCrcTable();
const getCrc32 = (bytes) => {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};
const writeUint16 = (array, value) => {
  array.push(value & 0xff, (value >>> 8) & 0xff);
};
const writeUint32 = (array, value) => {
  array.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
};
const textEncoder = new TextEncoder();
const createZipBlob = (files, type) => {
  const output = [];
  const centralDirectory = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = textEncoder.encode(file.name);
    const contentBytes = textEncoder.encode(file.content);
    const crc = getCrc32(contentBytes);

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, crc);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...contentBytes);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, crc);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, offset);
    centralDirectory.push(...nameBytes);

    offset = output.length;
  });

  const centralDirectoryOffset = output.length;
  output.push(...centralDirectory);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralDirectoryOffset);
  writeUint16(output, 0);

  return new Blob([new Uint8Array(output)], { type });
};
const createXlsxBlob = (headers, rows) => {
  const cellReference = (rowIndex, columnIndex) => {
    let column = "";
    let number = columnIndex + 1;
    while (number > 0) {
      const remainder = (number - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      number = Math.floor((number - 1) / 26);
    }
    return `${column}${rowIndex + 1}`;
  };
  const allRows = [headers, ...rows];
  const minimumColumnWidths = {
    "Transaction ID": 30,
    "Student Name": 18,
    "Student Email": 34,
    Amount: 14,
    "Date & Time": 24,
    "Payment Status": 18,
  };
  const getColumnWidth = (header, columnIndex) => {
    const widestValueLength = allRows.reduce((widest, row) => {
      const valueLength = String(row[columnIndex] ?? "").length;
      return Math.max(widest, valueLength);
    }, String(header).length);
    return Math.min(60, Math.max(minimumColumnWidths[header] || 14, widestValueLength + 4));
  };
  const columnWidths = headers
    .map((header, index) => `<col min="${index + 1}" max="${index + 1}" width="${getColumnWidth(header, index)}" customWidth="1"/>`)
    .join("");
  const sheetRows = allRows
    .map((row, rowIndex) => (
      `<row r="${rowIndex + 1}" ht="${rowIndex === 0 ? 24 : 21}" customHeight="1">${headers
        .map((_, columnIndex) => `<c r="${cellReference(rowIndex, columnIndex)}" t="inlineStr" s="${rowIndex === 0 ? 1 : 2}"><is><t>${escapeSpreadsheetCell(row[columnIndex])}</t></is></c>`)
        .join("")}</row>`
    ))
    .join("");
  const lastColumn = cellReference(0, headers.length - 1).replace("1", "");
  const lastRow = allRows.length;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columnWidths}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`;

  return createZipBlob(
    [
      {
        name: "[Content_Types].xml",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      },
      {
        name: "_rels/.rels",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      },
      {
        name: "xl/workbook.xml",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Transactions" sheetId="1" r:id="rId1"/></sheets></workbook>',
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      },
      {
        name: "xl/styles.xml",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF4FB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB8C4D6"/></left><right style="thin"><color rgb="FFB8C4D6"/></right><top style="thin"><color rgb="FFB8C4D6"/></top><bottom style="thin"><color rgb="FFB8C4D6"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="0"/></xf><xf fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="0"/></xf></cellXfs></styleSheet>',
      },
      { name: "xl/worksheets/sheet1.xml", content: sheet },
    ],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
};
const fallbackTransactions = [
  ["TXN001", "John Doe", "Campus Cafe", "₹12.50", "Completed", "2 mins ago"],
  ["TXN002", "Jane Smith", "Library Store", "₹8.00", "Completed", "5 mins ago"],
  ["TXN003", "Mike Johnson", "Sports Shop", "₹25.00", "Pending", "10 mins ago"],
  ["TXN004", "Sarah Williams", "Campus Cafe", "₹15.75", "Completed", "15 mins ago"],
];

const fallbackStudents = [
  {
    _id: "STU12345",
    name: "John Doe",
    email: "john.doe@university.edu",
    phone: "+1 234 567 8900",
    walletBalance: 245.8,
  },
  {
    _id: "STU12346",
    name: "Jane Smith",
    email: "jane.smith@university.edu",
    phone: "+1 234 567 8901",
    walletBalance: 180.5,
  },
  {
    _id: "STU12347",
    name: "Mike Johnson",
    email: "mike.johnson@university.edu",
    phone: "+1 234 567 8902",
    walletBalance: 92,
  },
  {
    _id: "STU12348",
    name: "Sarah Williams",
    email: "sarah.williams@university.edu",
    phone: "+1 234 567 8903",
    walletBalance: 320.75,
  },
];

const fallbackVendors = [
  {
    _id: "V001",
    name: "Campus Cafe",
    owner: "Robert Brown",
    email: "cafe@campus.edu",
    phone: "+1 234 567 8900",
    vendorStatus: "approved",
    totalSales: 12450,
  },
  {
    _id: "V002",
    name: "Library Store",
    owner: "Emma Wilson",
    email: "library@campus.edu",
    phone: "+1 234 567 8901",
    vendorStatus: "approved",
    totalSales: 8320,
  },
  {
    _id: "V003",
    name: "Sports Shop",
    owner: "James Davis",
    email: "sports@campus.edu",
    phone: "+1 234 567 8902",
    vendorStatus: "rejected",
    totalSales: 5670,
  },
];

const getStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("cpacUser") || "{}");
  } catch {
    return {};
  }
};

const getComparableIdentity = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value._id || value.id || value.email || value.name || "";
  }
  return String(value);
};

const isSameUser = (left, right) => {
  const leftIdentity = getComparableIdentity(left).toLowerCase();
  const rightIdentity = getComparableIdentity(right).toLowerCase();

  if (leftIdentity && rightIdentity && leftIdentity === rightIdentity) {
    return true;
  }

  const leftEmail = String(left?.email || "").toLowerCase();
  const rightEmail = String(right?.email || "").toLowerCase();
  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    return true;
  }

  const leftName = String(left?.name || "").toLowerCase();
  const rightName = String(right?.name || "").toLowerCase();
  return Boolean(leftName && rightName && leftName === rightName);
};

const getStudentTransactionRecords = (transactions, student) => {
  if (!student) return [];

  return transactions.filter((transaction) => {
    if (transaction.type === "payment") {
      return isSameUser(transaction.student || transaction.fromWallet?.owner, student);
    }

    if (transaction.type === "wallet_topup" || transaction.type === "refund") {
      return isSameUser(transaction.student || transaction.toWallet?.owner, student);
    }

    return isSameUser(transaction.student || transaction.fromWallet?.owner || transaction.toWallet?.owner, student);
  });
};

const getTransactionPartyName = (party) => party?.name || "-";

const buildProfileForm = (user = {}) => ({
  name: user.name || "Admin User",
  email: user.email || "admin@campuswallet.com",
  phone: user.phone || "",
  photo: user.profilePicture || "",
  accountStatus: user.accountStatus || "Active",
  joinDate:
    user.joinDate ||
    (user.createdAt
      ? new Date(user.createdAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })),
});

const getNameInitials = (name = "Admin User") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "AU";
  }

  const firstInitial = parts[0].charAt(0);
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) : parts[0].charAt(1);

  return `${firstInitial}${lastInitial || ""}`.toUpperCase();
};

function AdminDashboardPage({ setPage }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState({ text: "", view: "" });
  const [error, setError] = useState({ text: "", view: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [walletRequests, setWalletRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [transactionTab, setTransactionTab] = useState("student");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [dashboardModal, setDashboardModal] = useState(null);
  const [selectedDashboardItem, setSelectedDashboardItem] = useState(null);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const activeViewRef = useRef(activeView);

  const [admin, setAdmin] = useState(getStoredAdmin);

  const [profileForm, setProfileForm] = useState(() => buildProfileForm(getStoredAdmin()));

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const clearAlerts = useCallback(() => {
    setMessage({ text: "", view: "" });
    setError({ text: "", view: "" });
  }, []);

  const showMessage = useCallback((text) => {
    setMessage({ text, view: activeViewRef.current });
    setError({ text: "", view: "" });
  }, []);

  const showError = useCallback((text) => {
    setError({ text, view: activeViewRef.current });
    setMessage({ text: "", view: "" });
  }, []);

  useEffect(() => {
    if (!message.text) return undefined;

    const timer = window.setTimeout(() => {
      setMessage((current) => (current === message ? { text: "", view: "" } : current));
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error.text) return undefined;

    const timer = window.setTimeout(() => {
      setError((current) => (current === error ? { text: "", view: "" } : current));
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [error]);

  const loadAdminData = useCallback(async (query = "") => {
    setIsLoading(true);
    setError({ text: "", view: "" });

    try {
      const [statsData, studentsData, vendorsData, transactionsData, walletRequestsData] = await Promise.all([
        getAdminStats(),
        getAdminStudents(query),
        getAdminVendors(query),
        getAdminTransactions(),
        getAdminWalletRequests(),
      ]);

      setStats(statsData.stats);
      setStudents(studentsData.students || []);
      setVendors(vendorsData.vendors || []);
      setTransactions(transactionsData.transactions || []);

      const formattedRequests = (walletRequestsData.requests || []).map((req) => {
        const date = new Date(req.createdAt);
        return {
          id: req._id || req.id,
          student: req.student?.name || "Student",
          studentId: req.student?._id ? `STU${req.student._id.slice(-5).toUpperCase()}` : "STU12345",
          amount: req.amount,
          requestDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          requestTime: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          status: req.status === "completed" ? "approved" : req.status === "failed" ? "rejected" : "pending",
        };
      });
      setWalletRequests(formattedRequests);
    } catch (loadError) {
      showError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAdminData("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem("cpacToken");

      if (!token) return;

      try {
        const data = await getProfile(token);
        const safeUser = { ...(data.user || {}) };
        delete safeUser.password;

        setAdmin(safeUser);
        setProfileForm(buildProfileForm(safeUser));
        localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      } catch (profileError) {
        console.error("Failed to load admin profile:", profileError);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("cpacToken")) return undefined;

    const loadNotifications = async () => {
      try {
        const data = await getNotifications();
        setNotifications(data.notifications || []);
      } catch (notificationError) {
        console.error("Failed to load notifications:", notificationError);
      }
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsNotifOpen(false);
        setIsProfileOpen(false);
        setDashboardModal(null);
        setSelectedDashboardItem(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!dashboardModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dashboardModal]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadAdminData(search);
  };

  const handleVendorStatus = async (vendorId, action) => {
    clearAlerts();

    try {
      const request = action === "approve" ? approveVendor : rejectVendor;
      await request(vendorId);
      showMessage(`Vendor ${action === "approve" ? "approved" : "rejected"} successfully.`);
      await loadAdminData(search);
    } catch (statusError) {
      showError(statusError.message);
    }
  };

  const handleWalletRequestStatus = async (requestId, nextStatus) => {
    clearAlerts();

    try {
      await updateWalletRequestStatus(requestId, { status: nextStatus });
      showMessage(`Money addition request ${nextStatus} successfully.`);
      await loadAdminData(search);
    } catch (statusError) {
      showError(statusError.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("cpacToken");
    localStorage.removeItem("cpacUserType");
    localStorage.removeItem("cpacUser");
    setPage("admin-login");
  };

  const handleClearNotif = async () => {
    try {
      await clearNotifications();
      setNotifications([]);
    } catch (notificationError) {
      console.error("Failed to clear notifications:", notificationError);
    }
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev) => ({ ...prev, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    clearAlerts();

    const token = localStorage.getItem("cpacToken");

    if (!token) {
      showError("Please login again to save profile changes.");
      return;
    }

    try {
      const data = await updateProfile(
        {
          name: profileForm.name.trim(),
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim(),
          profilePicture: profileForm.photo,
        },
        token
      );
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;

      setAdmin(safeUser);
      setProfileForm(buildProfileForm(safeUser));
      localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      setIsEditingProfile(false);
      showMessage("Profile updated successfully.");
    } catch (saveError) {
      showError(saveError.message);
    }
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const statCards = [
    {
      type: "students",
      label: "Total Students",
      value: formatNumber(stats?.totalStudents),
      trend: "12% vs last month",
      icon: "students",
      tone: "blue",
    },
    {
      type: "vendors",
      label: "Total Vendors",
      value: formatNumber(stats?.totalVendors),
      trend: "5% vs last month",
      icon: "store",
      tone: "cyan",
    },
    {
      type: "transactions",
      label: "Total Transactions",
      value: formatNumber(stats?.totalTransactions),
      trend: "18% vs last month",
      icon: "swap",
      tone: "plain",
    },
    {
      type: "wallet",
      label: "Total Wallet Balance",
      value: formatMoney(stats?.totalWalletBalance),
      trend: "8% vs last month",
      icon: "wallet",
      tone: "plain",
    },
  ];
  const recentRows = transactions.length
    ? transactions.slice(0, 4).map((transaction, index) => {
        const statusText = transaction.status || "Completed";
        return [
          `TXN${String(index + 1).padStart(3, "0")}`,
          transaction.student?.name || "-",
          transaction.vendor?.name || "Wallet Top-up",
          formatMoney(transaction.amount),
          <span className={`transaction-status ${String(statusText).toLowerCase()}`}>
            {statusText}
          </span>,
          new Date(transaction.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        ];
      })
    : fallbackTransactions;
  const visibleStudents = students.length ? students : fallbackStudents;
  const filteredStudents = visibleStudents.filter((student, index) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const studentId = student._id?.startsWith("STU")
      ? student._id
      : `STU${String(index + 12345)}`;

    return [
      student.name,
      student.email,
      student.phone,
      studentId,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  const studentTotalBalance = students.length
    ? students.reduce((total, student) => total + Number(student.walletBalance || 0), 0)
    : 125420;
  const averageStudentBalance = visibleStudents.length
    ? studentTotalBalance / visibleStudents.length
    : 0;
  const studentStats = [
    ["Total Students", formatNumber(stats?.totalStudents || visibleStudents.length)],
    ["Active Users", formatNumber(stats?.totalStudents || visibleStudents.length), "green"],
    ["Total Balance", formatMoney(stats?.totalWalletBalance || studentTotalBalance)],
    ["Avg. Balance", `₹${averageStudentBalance.toFixed(2)}`],
  ];
  const visibleVendors = vendors.length ? vendors : fallbackVendors;
  const filteredVendors = visibleVendors.filter((vendor, index) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const vendorId = vendor._id?.startsWith("V")
      ? vendor._id
      : `V${String(index + 1).padStart(3, "0")}`;

    return [
      vendor.name,
      vendor.owner,
      vendor.email,
      vendor.phone,
      vendorId,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  const getVendorSales = (vendor) => {
    if (vendor.totalSales) {
      return Number(vendor.totalSales);
    }

    return transactions.reduce((total, transaction) => {
      const transactionVendorId = transaction.vendor?._id || transaction.vendor;
      const transactionVendorName = transaction.vendor?.name;
      const isVendorMatch = transactionVendorId === vendor._id || transactionVendorName === vendor.name;

      return isVendorMatch ? total + Number(transaction.amount || 0) : total;
    }, 0);
  };

  const getVendorTransactionRecords = (vendor) =>
    transactions.filter((transaction) => {
      const transactionVendorId =
        transaction.vendor?._id ||
        transaction.vendor ||
        transaction.toWallet?.owner?._id ||
        transaction.toWallet?.owner;
      const transactionVendorName =
        transaction.vendor?.name ||
        transaction.toWallet?.owner?.name;
      const isReceivedPayment = String(transaction.type || "").toLowerCase() === "payment";

      return isReceivedPayment && (transactionVendorId === vendor._id || transactionVendorName === vendor.name);
    });

  const getVendorStatusLabel = (status) => {
    if (status === "approved") {
      return "Active";
    }

    if (status === "rejected") {
      return "Inactive";
    }

    return "Pending";
  };

  const pendingWalletRequests = walletRequests.filter((request) => request.status === "pending").length;
  const adminDisplayName = admin.name || "Admin User";
  const adminPhoto = admin.profilePicture || "";
  const adminInitials = getNameInitials(adminDisplayName);

  const filteredTransactions = transactions.filter((transaction) => {
    const type = String(transaction.type || "").toLowerCase();
    const isStudentTransaction = type.includes("student") || type.includes("wallet") || type.includes("topup") || (transaction.student && !transaction.vendor);
    const isVendorTransaction = type.includes("vendor") || type.includes("payment") || type.includes("purchase") || transaction.vendor;

    if (transactionTab === "student") {
      return isStudentTransaction;
    }
    return isVendorTransaction;
  });

  const openDashboardModal = (type) => {
    setSelectedDashboardItem(null);
    setDashboardModal(type);
  };

  const closeDashboardModal = () => {
    setDashboardModal(null);
    setSelectedDashboardItem(null);
  };

  return (
    <div className="admin-dashboard-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon">
            <AdminIcon type="wallet" />
          </span>
          <div>
            <strong>Campus<br />Wallet</strong>
            <span>Admin Panel</span>
          </div>
          <button type="button" aria-label="Collapse sidebar">
            <AdminIcon type="chevron" />
          </button>
        </div>

        <nav aria-label="Admin dashboard navigation">
          {[
            ["dashboard", "Dashboard", "grid"],
            ["students", "Students", "students"],
            ["vendors", "Vendors", "store"],
            ["transactions", "Transactions", "swap"],
            ["wallet", "Wallet", "wallet"],
            ["profile", "Profile", "user"],
          ].map(([view, label, icon]) => (
            <button
              className={activeView === view ? "active" : ""}
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
            >
              <AdminIcon type={icon} />
              {label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-logout" type="button" onClick={handleLogout}>
            <AdminIcon type="logout" />
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-navbar">
          <div>
            <h1>
              {activeView === "students"
                ? "Student Management"
                : activeView === "vendors"
                  ? "Vendor Management"
                  : activeView === "wallet"
                    ? "Wallet Management"
                    : activeView === "dashboard"
                      ? "Dashboard"
                      : activeView === "profile" && isEditingProfile
                        ? "Edit Profile"
                      : pageTitle(activeView)}
            </h1>
            <p>{activeView === "students" ? "Manage students and wallet balances" : today}</p>
          </div>

          <div className="admin-navbar-actions">
            <div className="notification-wrapper" ref={notifRef}>
              <button
                className={`notification-button${isNotifOpen ? " active" : ""}`}
                type="button"
                aria-label="Notifications"
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  setIsProfileOpen(false);
                }}
              >
                <AdminIcon type="bell" />
                {notifications.length > 0 && <span />}
              </button>

              {isNotifOpen && (
                <div className="notification-dropdown">
                  <div className="dropdown-header">
                    <h3>Notifications</h3>
                    {notifications.length > 0 && (
                      <button className="clear-btn" type="button" onClick={handleClearNotif}>
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div key={notif._id} className="notification-item">
                          <p>{notif.text}</p>
                          <span className="notif-time">{new Date(notif.createdAt).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="notification-empty">No new notifications</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="profile-wrapper" ref={profileRef}>
              <div
                className="profile-trigger-area"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotifOpen(false);
                }}
              >
                <div className="profile-summary">
                  <strong>{adminDisplayName}</strong>
                  <span>Administrator</span>
                </div>
                <span className="profile-avatar">
                  {adminPhoto ? (
                    <img src={adminPhoto} alt={`${adminDisplayName} profile`} />
                  ) : (
                    adminInitials
                  )}
                </span>
              </div>

              {isProfileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-info">
                    <span className="profile-dropdown-avatar">
                      {adminPhoto ? (
                        <img src={adminPhoto} alt={`${adminDisplayName} profile`} />
                      ) : (
                        adminInitials
                      )}
                    </span>
                    <strong>{adminDisplayName}</strong>
                    <span className="email">{admin.email || "admin@campuswallet.com"}</span>
                    <span className="badge">Administrator</span>
                  </div>
                  <div className="profile-dropdown-actions">
                    <button className="logout-btn" type="button" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {error.text && error.view === activeView && <p className="admin-alert error">{error.text}</p>}
        {message.text && message.view === activeView && <p className="admin-alert success">{message.text}</p>}

        {isLoading ? (
          <div className="admin-loading">Loading admin data...</div>
        ) : (
          <>
            {activeView === "dashboard" && (
              <>
                <section className="admin-stats-grid" aria-label="Dashboard statistics">
                  {statCards.map((card) => (
                    <article
                      className="admin-stat-card clickable"
                      key={card.label}
                      role="button"
                      tabIndex={0}
                      aria-haspopup="dialog"
                      onClick={() => openDashboardModal(card.type)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDashboardModal(card.type);
                        }
                      }}
                    >
                      <div>
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                        <em>↑ {card.trend}</em>
                      </div>
                      <span className={`admin-stat-icon ${card.tone}`}>
                        <AdminIcon type={card.icon} />
                      </span>
                    </article>
                  ))}
                </section>

                <section className="admin-recent-section">
                  <div className="admin-section-title">
                    <h2>Recent Transactions</h2>
                    <button type="button" onClick={() => setActiveView("transactions")}>View All</button>
                  </div>
                  <AdminTable
                    columns={["Transaction ID", "Student", "Vendor", "Amount", "Status", "Time"]}
                    rows={recentRows}
                    emptyText="No transactions found."
                  />
                </section>
              </>
            )}

            {activeView === "students" && (
              <>
                <section className="student-management-stats" aria-label="Student statistics">
                  {studentStats.map(([label, value, tone]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong className={tone || ""}>{value}</strong>
                    </article>
                  ))}
                </section>

                <section className="student-management-tools" aria-label="Student tools">
                  <form className="student-management-search" onSubmit={handleSearch}>
                    <AdminIcon type="search" />
                    <input
                      type="search"
                      placeholder="Search students by name, email, phone, or ID..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </form>
                  <button
                    className="student-add-button"
                    type="button"
                    onClick={() => showMessage("Students can be added from the signup flow.")}
                  >
                    <span>+</span>
                    Add Student
                  </button>
                </section>

                <section className="student-management-table">
                  <div className="admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Wallet Balance</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, index) => {
                          const studentId = student._id?.startsWith("STU")
                            ? student._id
                            : `STU${String(index + 12345)}`;

                          return (
                            <tr key={student._id || student.email}>
                              <td>{studentId}</td>
                              <td>
                                <div className="student-name-cell">
                                  <span>
                                    <AdminIcon type="user" />
                                  </span>
                                  <div>
                                    <strong>{student.name}</strong>
                                    <em>{student.email}</em>
                                  </div>
                                </div>
                              </td>
                              <td>{student.phone || "-"}</td>
                              <td className="student-balance">{`₹${Number(student.walletBalance || 0).toFixed(2)}`}</td>
                              <td>
                                <span className="student-active-pill">Active</span>
                              </td>
                              <td>
                                <button
                                  className="student-money-button"
                                  type="button"
                                  onClick={() => setActiveView("wallet")}
                                >
                                  <span>₹</span>
                                  Add Money
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeView === "vendors" && (
              <>
                <section className="vendor-management-tools" aria-label="Vendor tools">
                  <form className="vendor-management-search" onSubmit={handleSearch}>
                    <AdminIcon type="search" />
                    <input
                      type="search"
                      placeholder="Search vendors by name, email, phone, or ID..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </form>
                  <button
                    className="vendor-add-button"
                    type="button"
                    onClick={() => showMessage("Vendors can be added from the signup flow.")}
                  >
                    <span>+</span>
                    Add Vendor
                  </button>
                </section>

                <section className="vendor-management-table">
                  <div className="admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Vendor ID</th>
                          <th>Shop Name</th>
                          <th>Owner</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Total Sales</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVendors.map((vendor, index) => {
                          const statusLabel = getVendorStatusLabel(vendor.vendorStatus);
                          const vendorId = vendor._id?.startsWith("V")
                            ? vendor._id
                            : `V${String(index + 1).padStart(3, "0")}`;

                          return (
                            <tr key={vendor._id || vendor.email}>
                              <td>{vendorId}</td>
                              <td>{vendor.name}</td>
                              <td>{vendor.owner || vendor.name}</td>
                              <td>{vendor.email}</td>
                              <td>{vendor.phone || "-"}</td>
                              <td>
                                <span className={`vendor-status ${statusLabel.toLowerCase()}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="vendor-sales">{formatMoney(getVendorSales(vendor))}</td>
                              <td>
                                <div className="vendor-row-actions">
                                  <button
                                    type="button"
                                    aria-label={`Show QR code for ${vendor.name}`}
                                    onClick={() => showMessage(`QR tools for ${vendor.name} are ready for setup.`)}
                                  >
                                    <AdminIcon type="qr" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Approve ${vendor.name}`}
                                    onClick={() => handleVendorStatus(vendor._id, "approve")}
                                    disabled={vendor._id?.startsWith("V")}
                                  >
                                    <AdminIcon type="edit" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Reject ${vendor.name}`}
                                    onClick={() => handleVendorStatus(vendor._id, "reject")}
                                    disabled={vendor._id?.startsWith("V")}
                                  >
                                    <AdminIcon type="trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            {activeView === "transactions" && (
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <h2>Transaction History</h2>
                  <span>{filteredTransactions.length} recent</span>
                </div>
                <div className="transaction-tabs">
                  <button
                    type="button"
                    className={transactionTab === "student" ? "active" : ""}
                    onClick={() => setTransactionTab("student")}
                  >
                    Student Transactions
                  </button>
                  <button
                    type="button"
                    className={transactionTab === "vendor" ? "active" : ""}
                    onClick={() => setTransactionTab("vendor")}
                  >
                    Vendor Transactions
                  </button>
                </div>
                <AdminTable
                  columns={["Student", "Vendor", "Type", "Amount", "Status", "Date"]}
                  rows={filteredTransactions.map((transaction) => {
                    const statusText = transaction.status || "Completed";
                    return [
                      transaction.student?.name || "-",
                      transaction.vendor?.name || "-",
                      transaction.type?.replace("_", " ") || "payment",
                      formatMoney(transaction.amount),
                      <span className={`transaction-status ${String(statusText).toLowerCase()}`}>
                        {statusText}
                      </span>,
                      new Date(transaction.createdAt).toLocaleString(),
                    ];
                  })}
                  emptyText="No transactions found."
                />
              </section>
            )}

            {activeView === "profile" && (
              <section className="admin-profile-page">
                <div className={`admin-profile-grid ${isEditingProfile ? "is-editing" : ""}`}>
                  {!isEditingProfile ? (
                    <section className="admin-panel admin-profile-card">
                      <div className="admin-profile-top">
                        <div className="admin-profile-photo">
                          {profileForm.photo ? (
                            <img src={profileForm.photo} alt="Profile" />
                          ) : (
                            <span>{getNameInitials(profileForm.name)}</span>
                          )}
                        </div>
                        <div>
                          <h2>{profileForm.name}</h2>
                          <span>Administrator</span>
                        </div>
                      </div>
                      <div className="admin-profile-details">
                        <div>
                          <strong>Full Name</strong>
                          <span>{profileForm.name}</span>
                        </div>
                        <div>
                          <strong>Role</strong>
                          <span>Administrator</span>
                        </div>
                        <div>
                          <strong>Email</strong>
                          <span>{profileForm.email}</span>
                        </div>
                        <div>
                          <strong>Phone Number</strong>
                          <span>{profileForm.phone || "Not available"}</span>
                        </div>
                        <div>
                          <strong>Account Status</strong>
                          <span className="admin-profile-status">{profileForm.accountStatus}</span>
                        </div>
                        <div>
                          <strong>Join Date</strong>
                          <span>{profileForm.joinDate}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="admin-profile-edit-button"
                        onClick={() => setIsEditingProfile(true)}
                      >
                        Edit Profile
                      </button>
                    </section>
                  ) : (
                    <section className="admin-panel admin-profile-edit-card">
                      <div className="admin-panel-heading">
                        <h2>Edit Profile</h2>
                        <span>Update your account details</span>
                      </div>
                      <form onSubmit={handleProfileSave} className="admin-profile-form">
                        <label className="admin-profile-edit-photo" aria-label="Profile photo">
                          <span className="admin-profile-photo">
                            {profileForm.photo ? (
                              <img src={profileForm.photo} alt="Profile" />
                            ) : (
                              <span>{getNameInitials(profileForm.name)}</span>
                            )}
                          </span>
                          <input type="file" accept="image/*" onChange={handleProfileImage} />
                        </label>
                        <label>
                          Full Name
                          <input
                            type="text"
                            name="name"
                            value={profileForm.name}
                            onChange={handleProfileChange}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            type="email"
                            name="email"
                            value={profileForm.email}
                            onChange={handleProfileChange}
                          />
                        </label>
                        <label>
                          Phone Number
                          <input
                            type="tel"
                            name="phone"
                            value={profileForm.phone}
                            onChange={handleProfileChange}
                          />
                        </label>
                        <div className="admin-profile-form-actions">
                          <button type="submit">Save Changes</button>
                          <button type="button" onClick={() => setIsEditingProfile(false)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </section>
                  )}
                </div>
              </section>
            )}

            {activeView === "student-details" && selectedStudent && (
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <h2>Student Details</h2>
                  <button type="button" onClick={() => navigateToAdminView("all-students")}>
                    ← Back to Students
                  </button>
                </div>
                <PersonDetails
                  person={selectedStudent}
                  isVendor={false}
                  totalSales={null}
                  totalTransactions={null}
                  allTransactions={transactions}
                  onShowTransactions={() => {}}
                />
              </section>
            )}

            {activeView === "wallet" && (
              <>
                <section className="wallet-management-stats" aria-label="Wallet request statistics">
                  {[
                    ["Pending Requests", pendingWalletRequests, "orange"],
                    ["Approved Today", 12, "green"],
                    ["Total Added Today", "₹1,850", ""],
                    ["Avg. Request", "₹75.00", ""],
                  ].map(([label, value, tone]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong className={tone}>{value}</strong>
                    </article>
                  ))}
                </section>

                <section className="wallet-management-section">
                  <h2>Add Money Requests</h2>
                  <div className="admin-table-wrap wallet-management-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>Student</th>
                          <th>Amount</th>
                          <th>Request Date</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletRequests.map((request) => (
                          <tr key={request.id}>
                            <td>{request.id}</td>
                            <td>
                              <div className="wallet-student-cell">
                                <strong>{request.student}</strong>
                                <span>{request.studentId}</span>
                              </div>
                            </td>
                            <td className="wallet-request-amount">{`₹${Number(request.amount).toFixed(2)}`}</td>
                            <td>
                              <div className="wallet-date-cell">
                                <strong>{request.requestDate}</strong>
                                <span>{request.requestTime}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`wallet-request-status ${request.status}`}>
                                <AdminIcon
                                  type={
                                    request.status === "pending"
                                      ? "clock"
                                      : request.status === "approved"
                                        ? "check"
                                        : "x"
                                  }
                                />
                                {request.status}
                              </span>
                            </td>
                            <td>
                              {request.status === "pending" ? (
                                <div className="wallet-request-actions">
                                  <button
                                    className="approve"
                                    type="button"
                                    onClick={() => handleWalletRequestStatus(request.id, "approved")}
                                  >
                                    <AdminIcon type="check" />
                                    Approve
                                  </button>
                                  <button
                                    className="reject"
                                    type="button"
                                    onClick={() => handleWalletRequestStatus(request.id, "rejected")}
                                  >
                                    <AdminIcon type="x" />
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="wallet-no-action">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {dashboardModal && (
          <DashboardDetailsModal
            type={dashboardModal}
            students={students}
            vendors={vendors}
            transactions={transactions}
            selectedItem={selectedDashboardItem}
            onSelect={setSelectedDashboardItem}
            onBack={() => setSelectedDashboardItem(null)}
            onClose={closeDashboardModal}
            getVendorSales={getVendorSales}
            getVendorTransactionRecords={getVendorTransactionRecords}
          />
        )}
      {dashboardModal && (
        <DashboardDetailsModal
          type={dashboardModal}
          students={students}
          vendors={vendors}
          transactions={transactions}
          selectedItem={selectedDashboardItem}
          onSelect={setSelectedDashboardItem}
          onBack={() => setSelectedDashboardItem(null)}
          onClose={closeDashboardModal}
          getVendorSales={getVendorSales}
          getVendorTransactionsCount={getVendorTransactionsCount}
        />
      )}
      </main>
    </div>
  );
}

function DashboardDetailsModal({
  type,
  students,
  vendors,
  transactions,
  selectedItem,
  onSelect,
  onBack,
  onClose,
  getVendorSales,
  getVendorTransactionRecords,
}) {
  const [studentTransactionTarget, setStudentTransactionTarget] = useState(null);
  const [vendorTransactionTarget, setVendorTransactionTarget] = useState(null);
  const [peopleSearchTerm, setPeopleSearchTerm] = useState("");

  const title = {
    students: "All Students",
    vendors: "All Vendors",
    transactions: "All Transactions",
    wallet: "Student Wallet Balances",
  }[type];

  const studentTransactions = type === "vendors" ? [] : getStudentTransactionRecords(transactions, selectedItem);
  const vendorTransactions =
    type === "vendors" && selectedItem ? getVendorTransactionRecords(selectedItem) : [];
  const isStudentTransactionView = Boolean(studentTransactionTarget);
  const isVendorTransactionView = Boolean(vendorTransactionTarget);
  const detailTitle = type === "vendors" ? "Vendor Details" : "Student Details";
  const isPeopleList = type === "students" || type === "vendors" || type === "wallet";
  const people = type === "vendors" ? vendors : students;
  const canSearchPeople = type === "students" || type === "vendors";
  const visiblePeople =
    canSearchPeople && peopleSearchTerm.trim()
      ? people.filter((person) =>
          String(person.name || "").toLowerCase().includes(peopleSearchTerm.trim().toLowerCase())
        )
      : people;

  useEffect(() => {
    setStudentTransactionTarget(null);
    setVendorTransactionTarget(null);
    setPeopleSearchTerm("");
  }, [selectedItem, type]);

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dashboard-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dashboard-modal-header">
          <div>
            {selectedItem && (
              <button
                className="dashboard-modal-back"
                type="button"
                onClick={isVendorTransactionView ? () => setVendorTransactionTarget(null) : onBack}
              >
                ← Back
              </button>
            )}
            <div className="dashboard-modal-title-row">
              <h2 id="dashboard-modal-title">
                {isVendorTransactionView ? "Received Transactions" : selectedItem ? detailTitle : title}
              </h2>
              {!selectedItem && canSearchPeople && (
                <input
                  className="dashboard-student-search"
                  type="search"
                  value={peopleSearchTerm}
                  onChange={(event) => setPeopleSearchTerm(event.target.value)}
                  placeholder="Search by name"
                  aria-label={`Search ${type} by name`}
                />
              )}
            </div>
            {!selectedItem && (
              <p>
                {type === "transactions"
                  ? `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`
                  : `${people.length} ${type === "vendors" ? "vendor" : "student"}${people.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
          <button className="dashboard-modal-close" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="dashboard-modal-body">
          {isStudentTransactionView ? (
            <StudentTransactionPanel student={studentTransactionTarget} transactions={studentTransactions} />
          ) : isVendorTransactionView ? (
            <VendorReceivedTransactionsPage vendor={vendorTransactionTarget} transactions={vendorTransactions} />
          ) : selectedItem ? (
            <PersonDetails
              person={selectedItem}
              isVendor={type === "vendors"}
              totalSales={type === "vendors" ? getVendorSales(selectedItem) : null}
              totalTransactions={type === "vendors" ? vendorTransactions.length : studentTransactions.length}
              onShowTransactions={() =>
                type === "vendors"
                  ? setVendorTransactionTarget(selectedItem)
                  : setStudentTransactionTarget(selectedItem)
              }
              totalTransactions={type === "vendors" ? getVendorTransactionsCount(selectedItem) : null}
              onShowTransactions={() => setStudentTransactionTarget(selectedItem)}
            />
          ) : type === "transactions" ? (
            <TransactionDetailsList transactions={transactions} />
          ) : isPeopleList ? (
            visiblePeople.length ? (
              <div className="dashboard-people-list">
                {visiblePeople.map((person) => (
                  <button
                    type="button"
                    className="dashboard-person-row"
                    key={person._id || person.email}
                    onClick={() => onSelect(person)}
                  >
                    <span className="dashboard-person-avatar">
                      {String(person.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="dashboard-person-info">
                      <strong>{person.name || "Unnamed user"}</strong>
                      <small>{person.email || "No email available"}</small>
                    </span>
                    <span className="dashboard-person-amount">
                      {type === "vendors" ? "Total received" : "Wallet balance"}
                      <strong>
                        {formatMoney(type === "vendors" ? getVendorSales(person) : person.walletBalance)}
                      </strong>
                    </span>
                    <span className="dashboard-row-chevron">›</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="dashboard-modal-empty">
                {canSearchPeople && peopleSearchTerm.trim()
                  ? `No ${type === "vendors" ? "vendors" : "students"} found with this name.`
                  : "No records found."}
              </p>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PersonDetails({ person, isVendor, totalSales, totalTransactions, onShowTransactions }) {
function PersonDetails({ person, isVendor, totalSales, totalTransactions, allTransactions = [], onShowTransactions = () => {} }) {
  const [showTxPanel, setShowTxPanel] = useState(false);

  const studentTransactionCount = !isVendor
    ? (allTransactions || []).filter((transaction) => {
      const transactionStudentId = String(transaction.student?._id || transaction.student || "").toLowerCase();
      const personId = String(person._id || "").toLowerCase();
      const transactionStudentName = String(transaction.student?.name || "").toLowerCase();
      const personName = String(person.name || "").toLowerCase();
      return transactionStudentId === personId || transactionStudentName === personName;
    }).length
    : Number(totalTransactions || 0);

  const fields = [
    { label: "Name", value: person.name || "-" },
    { label: "Email", value: person.email || "-" },
    { label: "Phone", value: person.phone || "-" },
    { label: "Account type", value: isVendor ? "Vendor" : "Student" },
    { label: "Account status", value: isVendor ? pageTitle(person.vendorStatus || "pending") : pageTitle(person.accountStatus || "active") },
    { label: "Wallet balance", value: formatMoney(person.walletBalance) },
    ...(isVendor ? [{ label: "Total amount received", value: formatMoney(totalSales) }] : []),
    { label: "Transactions", value: formatNumber(totalTransactions), actionLabel: "Show More", onAction: onShowTransactions },
    { label: "Joined", value: person.createdAt ? new Date(person.createdAt).toLocaleString() : "-" },
  ];

  return (
    <div className="dashboard-person-details">
      <div className="dashboard-detail-identity">
        <span>{String(person.name || "?").charAt(0).toUpperCase()}</span>
        <div>
          <h3>{person.name || "Unnamed user"}</h3>
          <p>{person.email || "No email available"}</p>
        </div>
      </div>
      <dl>
        {fields.map((field) => (
          <div key={field.label} style={field.actionLabel ? { alignItems: "center" } : undefined}>
            <dt>{field.label}</dt>
            <dd
              className={field.label === "Account status" && field.value === "Active" ? "active-status" : ""}
              style={field.actionLabel ? { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" } : undefined}
            >
              <span>{field.value}</span>
              {field.actionLabel && (
                <button
                  type="button"
                  onClick={field.onAction}
                  style={{
                    border: 0,
                    borderRadius: "8px",
                    padding: "7px 12px",
                    background: "#2563eb",
                    color: "#ffffff",
                    font: "inherit",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {field.actionLabel}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function VendorReceivedTransactionsPage({ vendor, transactions }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const receivedTransactions = [...transactions].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const totalReceivedAmount = receivedTransactions.reduce(
    (total, transaction) => total + Number(transaction.amount || 0),
    0
  );
  const latestPaymentDate = receivedTransactions[0]?.createdAt
    ? new Date(receivedTransactions[0].createdAt).toLocaleString()
    : "-";

  const filteredTransactions = receivedTransactions.filter((transaction) => {
    const transactionId = String(transaction._id || transaction.id || "");
    const status = String(transaction.status || "completed").toLowerCase();
    const transactionType = String(transaction.type || "").toLowerCase();

    const matchesSearch = !searchTerm.trim() || transactionId.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesType = typeFilter === "all" || transactionType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const sortedTransactions = [...filteredTransactions].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageTransactions = sortedTransactions.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortOrder]);

  const getReceivedTransactionRow = (transaction) => {
    const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
    const student = transaction.student || transaction.fromWallet?.owner;

    return {
      id: transaction._id || transaction.id || "-",
      studentName: student?.name || "-",
      studentEmail: student?.email || "-",
      amount: formatMoney(transaction.amount),
      dateTime: createdAt ? createdAt.toLocaleString() : "-",
      paymentStatus: transaction.status || "completed",
    };
  };

  const handleExportReceivedTransactions = () => {
    const headers = [
      "Transaction ID",
      "Student Name",
      "Student Email",
      "Amount",
      "Date & Time",
      "Payment Status",
    ];
    const rows = sortedTransactions.map((transaction) => {
      const row = getReceivedTransactionRow(transaction);
      return [
        row.id,
        row.studentName,
        row.studentEmail,
        row.amount,
        row.dateTime,
        row.paymentStatus,
      ];
    });
    const vendorName = sanitizeFileNamePart(vendor?.name);
    const fileName = `Vendor_Received_Transactions_${vendorName}_${getDateStamp()}.xlsx`;
    downloadBlob(createXlsxBlob(headers, rows), fileName);
  };

  if (!receivedTransactions.length) {
    return <p className="dashboard-modal-empty">No received transactions found for this vendor.</p>;
  }

  return (
    <div className="dashboard-student-transactions-panel">
      <section
        className="dashboard-student-transactions-summary"
        aria-label={`${vendor?.name || "Vendor"} received transaction summary`}
      >
        <article className="dashboard-student-transactions-summary-card">
          <span>Total Transactions</span>
          <strong>{formatNumber(receivedTransactions.length)}</strong>
        </article>
        <article className="dashboard-student-transactions-summary-card">
          <span>Total Received Amount</span>
          <strong>{formatMoney(totalReceivedAmount)}</strong>
        </article>
        <article className="dashboard-student-transactions-summary-card">
          <span>Latest Payment</span>
          <strong>{latestPaymentDate}</strong>
        </article>
      </section>

      <section className="dashboard-student-transactions-toolbar" aria-label="Vendor transaction filters">
        <div className="dashboard-student-transactions-field">
          <label htmlFor="vendor-transaction-search">Search by Transaction ID</label>
          <input
            id="vendor-transaction-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search transaction ID"
          />
        </div>

        <div className="dashboard-student-transactions-field">
          <label htmlFor="vendor-transaction-status">Filter by Status</label>
          <select id="vendor-transaction-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="dashboard-student-transactions-field">
          <label htmlFor="vendor-transaction-type">Filter by Transaction Type</label>
          <select id="vendor-transaction-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="payment">Received</option>
          </select>
        </div>

        <div className="dashboard-student-transactions-field">
          <label htmlFor="vendor-transaction-sort">Sort by Date</label>
          <select id="vendor-transaction-sort" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </section>

      {sortedTransactions.length === 0 ? (
        <p className="dashboard-modal-empty">No transactions match the selected filters.</p>
      ) : (
        <>
          <div className="dashboard-student-transactions-table">
            <table>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Student Name</th>
                  <th>Student Email</th>
                  <th>Amount</th>
                  <th>Date &amp; Time</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {pageTransactions.map((transaction) => {
                  const row = getReceivedTransactionRow(transaction);

                  return (
                    <tr key={transaction._id || transaction.id}>
                      <td>{row.id}</td>
                      <td>{row.studentName}</td>
                      <td>{row.studentEmail}</td>
                      <td>{row.amount}</td>
                      <td>{row.dateTime}</td>
                      <td>
                        <span className={`transaction-status ${String(row.paymentStatus).toLowerCase()}`}>
                          {row.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="dashboard-student-transactions-pagination">
            <span>
              Showing {pageTransactions.length} of {sortedTransactions.length} transactions
            </span>
            <div>
              <button
                type="button"
                onClick={handleExportReceivedTransactions}
                style={{
                  background: "#2563eb",
                  borderColor: "#2563eb",
                  color: "#ffffff",
                }}
              >
                Export
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={visiblePage === 1}>
                Previous
              </button>
              <span>
                Page {visiblePage} of {totalPages}
              </span>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={visiblePage === totalPages}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function StudentTransactionPanel({ student, transactions }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = window.setTimeout(() => setIsLoading(false), 0);
    return () => window.clearTimeout(timer);
  }, [student, transactions]);

  const studentTransactions = [...transactions].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const chronologicalTransactions = [...studentTransactions].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
  const balanceFieldNames = {
    initial: ["initialBalance", "balanceBefore", "walletBalanceBefore"],
    total: ["totalBalance", "balanceAfter", "walletBalanceAfter", "runningBalance"],
  };
  const getStoredBalance = (transaction, fieldNames) => {
    const fieldName = fieldNames.find((name) => transaction[name] !== undefined && transaction[name] !== null);
    return fieldName ? Number(transaction[fieldName]) : null;
  };
  const balanceSeed = chronologicalTransactions.reduce((balance, transaction) => {
    const amount = Number(transaction.amount || 0);
    const isCredit = transaction.type === "wallet_topup" || transaction.type === "refund";
    return isCredit ? balance - amount : balance + amount;
  }, Number(student?.walletBalance || 0));
  const transactionBalances = chronologicalTransactions.reduce(
    (accumulator, transaction) => {
      const transactionId = transaction._id || transaction.id;
      const amount = Number(transaction.amount || 0);
      const isCredit = transaction.type === "wallet_topup" || transaction.type === "refund";
      const storedTotalBalance = getStoredBalance(transaction, balanceFieldNames.total);
      const storedInitialBalance = getStoredBalance(transaction, balanceFieldNames.initial);
      const initialBalance = storedInitialBalance ?? accumulator.runningBalance;
      const totalBalance = storedTotalBalance ?? (isCredit ? initialBalance + amount : initialBalance - amount);

      accumulator.byId[String(transactionId)] = { initialBalance, totalBalance };
      accumulator.runningBalance = totalBalance;
      return accumulator;
    },
    { byId: {}, runningBalance: balanceSeed }
  ).byId;

  const summary = studentTransactions.reduce(
    (accumulator, transaction) => {
      const amount = Number(transaction.amount || 0);
      const isCredit = transaction.type === "wallet_topup" || transaction.type === "refund";
      const isDebit = transaction.type === "payment";

      accumulator.totalTransactions += 1;
      if (isCredit) {
        accumulator.totalCreditAmount += amount;
      }
      if (isDebit) {
        accumulator.totalDebitAmount += amount;
        accumulator.totalAmountSpent += amount;
      }
      if (transaction.type === "wallet_topup") {
        accumulator.totalAmountAdded += amount;
      }
      return accumulator;
    },
    {
      totalTransactions: 0,
      totalCreditAmount: 0,
      totalDebitAmount: 0,
      totalAmountSpent: 0,
      totalAmountAdded: 0,
    }
  );

  const filteredTransactions = studentTransactions.filter((transaction) => {
    const transactionId = String(transaction._id || transaction.id || "");
    const status = String(transaction.status || "completed").toLowerCase();
    const transactionType = transaction.type === "payment" ? "debit" : "credit";

    const matchesSearch = !searchTerm.trim() || transactionId.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesType = typeFilter === "all" || transactionType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const sortedTransactions = [...filteredTransactions].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageTransactions = sortedTransactions.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortOrder]);

  const getTransactionRow = (transaction) => {
    const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
    const isCredit = transaction.type === "wallet_topup" || transaction.type === "refund";
    const amountPrefix = isCredit ? "+" : "-";
    const transactionType = isCredit ? "Credit" : "Debit";
    const balances = transactionBalances[String(transaction._id || transaction.id)] || {
      initialBalance: 0,
      totalBalance: 0,
    };

    return {
      id: transaction._id || transaction.id || "-",
      date: createdAt ? createdAt.toLocaleDateString() : "-",
      time: createdAt ? createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
      initialBalance: formatMoney(balances.initialBalance),
      amount: `${amountPrefix}${formatMoney(transaction.amount).replace(/^₹/, "₹")}`,
      totalBalance: formatMoney(balances.totalBalance),
      transactionType,
      vendorName: getTransactionPartyName(transaction.vendor || transaction.toWallet?.owner),
      studentName: getTransactionPartyName(transaction.student || transaction.fromWallet?.owner || transaction.toWallet?.owner),
      paymentStatus: transaction.status || "completed",
    };
  };

  const getExportData = () => {
    const headers = [
      "Transaction ID",
      "Date",
      "Time",
      "Initial Balance",
      "Amount",
      "Total Balance",
      "Transaction Type",
      "Vendor Name",
      "Student Name",
      "Payment Status",
    ];
    const rows = sortedTransactions.map((transaction) => {
      const row = getTransactionRow(transaction);
      return [
        row.id,
        row.date,
        row.time,
        row.initialBalance,
        row.amount,
        row.totalBalance,
        row.transactionType,
        row.vendorName,
        row.studentName,
        row.paymentStatus,
      ];
    });

    return { headers, rows };
  };

  const getExportFileBaseName = () => {
    const studentName = sanitizeFileNamePart(student?.name);
    return `Student_Transactions_${studentName}_${getDateStamp()}`;
  };

  const handleExportTransactions = () => {
    const { headers, rows } = getExportData();
    const fileBaseName = getExportFileBaseName();
    downloadBlob(createXlsxBlob(headers, rows), `${fileBaseName}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="dashboard-student-transactions-loading">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid rgba(36, 68, 194, 0.14)", borderTopColor: "#2444c2", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span>Loading transaction history...</span>
        </div>
      </div>
    );
  }

  if (!studentTransactions.length) {
    return <p className="dashboard-modal-empty">No transactions found for this student.</p>;
  }

  return (
    <div className="dashboard-student-transactions-panel">
      <section className="dashboard-student-transactions-summary" aria-label="Transaction summary">
        <article className="dashboard-student-transactions-summary-card">
          <span>Total Transactions</span>
          <strong>{formatNumber(summary.totalTransactions)}</strong>
        </article>
        <article className="dashboard-student-transactions-summary-card">
          <span>Total Credit Amount</span>
          <strong>{formatMoney(summary.totalCreditAmount)}</strong>
        </article>
        <article className="dashboard-student-transactions-summary-card">
          <span>Total Debit Amount</span>
          <strong>{formatMoney(summary.totalDebitAmount)}</strong>
        </article>
      </section>

      <section className="dashboard-student-transactions-toolbar" aria-label="Transaction filters">
        <div className="dashboard-student-transactions-field">
          <label htmlFor="student-transaction-search">Search by Transaction ID</label>
          <input
            id="student-transaction-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search transaction ID"
          />
        </div>

        <div className="dashboard-student-transactions-field">
          <label htmlFor="student-transaction-status">Filter by Status</label>
          <select id="student-transaction-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="dashboard-student-transactions-field">
          <label htmlFor="student-transaction-type">Filter by Transaction Type</label>
          <select id="student-transaction-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </div>

        <div className="dashboard-student-transactions-field">
          <label htmlFor="student-transaction-sort">Sort by Date</label>
          <select id="student-transaction-sort" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </section>

      {sortedTransactions.length === 0 ? (
        <p className="dashboard-modal-empty">No transactions match the selected filters.</p>
      ) : (
        <>
          <div className="dashboard-student-transactions-table student-detail-transactions-table">
            <table>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Initial Balance</th>
                  <th>Amount</th>
                  <th>Total Balance</th>
                  <th>Transaction Type</th>
                  <th>Vendor Name</th>
                  <th>Student Name</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {pageTransactions.map((transaction) => {
                  const row = getTransactionRow(transaction);

                  return (
                    <tr key={transaction._id || transaction.id}>
                      <td>{row.id}</td>
                      <td>{row.date}</td>
                      <td>{row.time}</td>
                      <td>{row.initialBalance}</td>
                      <td>{row.amount}</td>
                      <td>{row.totalBalance}</td>
                      <td>{row.transactionType}</td>
                      <td>{row.vendorName}</td>
                      <td>{row.studentName}</td>
                      <td>
                        <span className={`transaction-status ${String(row.paymentStatus).toLowerCase()}`}>
                          {row.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="dashboard-student-transactions-pagination">
            <span>
              Showing {pageTransactions.length} of {sortedTransactions.length} transactions
            </span>
            <div>
              <button
                type="button"
                onClick={handleExportTransactions}
                style={{
                  background: "#2563eb",
                  borderColor: "#2563eb",
                  color: "#ffffff",
                }}
              >
                Export
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={visiblePage === 1}>
                Previous
              </button>
              <span>
                Page {visiblePage} of {totalPages}
              </span>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={visiblePage === totalPages}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TransactionDetailsList({ transactions }) {
  if (!transactions.length) {
    return <p className="dashboard-modal-empty">No transactions found.</p>;
  }

  return (
    <div className="dashboard-transaction-list">
      {transactions.map((transaction, index) => {
        const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
        return (
          <article key={transaction._id || index} className="dashboard-transaction-row">
            <div>
              <strong>{transaction.student?.name || "Wallet top-up"}</strong>
              <span>→</span>
              <strong>{transaction.vendor?.name || "Student wallet"}</strong>
              <p>{transaction.description || pageTitle(String(transaction.type || "transaction").replaceAll("_", " "))}</p>
            </div>
            <div className="dashboard-transaction-meta">
              <strong>{formatMoney(transaction.amount)}</strong>
              <span className={`transaction-status ${String(transaction.status || "completed").toLowerCase()}`}>
                {transaction.status || "completed"}
              </span>
              <time dateTime={transaction.createdAt}>
                {createdAt
                  ? createdAt.toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "-"}
              </time>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function pageTitle(view) {
  return view.charAt(0).toUpperCase() + view.slice(1);
}

function AdminTable({ columns, rows, emptyText }) {
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdminIcon({ type }) {
  const icons = {
    bell: (
      <>
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
        <path d="M10 21h4" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m15 18-6-6 6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
      </>
    ),
    qr: (
      <>
        <rect x="4" y="4" width="5" height="5" rx="1" />
        <rect x="15" y="4" width="5" height="5" rx="1" />
        <rect x="4" y="15" width="5" height="5" rx="1" />
        <path d="M15 15h2v2h-2z" />
        <path d="M20 15v5h-5" />
        <path d="M12 4v3" />
        <path d="M12 12h3" />
        <path d="M12 17v3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2 .4l-.1.1h-4l-.1-.1a1.8 1.8 0 0 0-2-.4l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1.2H6v-4h.2a1.8 1.8 0 0 0 1.6-1.2 1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.4.2.1a1.8 1.8 0 0 0 2-.4l.1-.1h4l.1.1a1.8 1.8 0 0 0 2 .4l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1.2h.2v4h-.2a1.8 1.8 0 0 0-1.6 1.2Z" />
      </>
    ),
    store: (
      <>
        <path d="M4 10h16l-2-5H6l-2 5Z" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 19v-5h6v5" />
      </>
    ),
    students: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15 14.5a5 5 0 0 1 6 4.5" />
      </>
    ),
    swap: (
      <>
        <path d="M7 7h12" />
        <path d="m15 3 4 4-4 4" />
        <path d="M17 17H5" />
        <path d="m9 21-4-4 4-4" />
      </>
    ),
    trend: (
      <>
        <path d="m4 16 6-6 4 4 6-8" />
        <path d="M14 6h6v6" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h13v14H6a2 2 0 0 1-2-2V7Z" />
        <path d="M4 9h16" />
        <path d="M16 13h4v4h-4a2 2 0 0 1 0-4Z" />
      </>
    ),
    x: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[type] || icons.grid}
    </svg>
  );
}


export default AdminDashboardPage;
