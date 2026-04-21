const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
app.use(cors());

const upload = multer();

const resend = new Resend(process.env.RESEND_API_KEY);

app.post("/send-report", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file received" });
    }

    const pdfBuffer = req.file.buffer;

    await resend.emails.send({
      from: "prasannaavijayakumar2006@gmail.com",
      to: "srikrishnaiitjee1@gmail.com", // 🔴 PUT YOUR EMAIL HERE
      subject: "Your Loan Report",
      html: "<p>Attached is your generated loan report.</p>",
      attachments: [
        {
          filename: "LoanReport.pdf",
          content: pdfBuffer,
        },
      ],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ success: false });
  }
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
