import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

// ✅ Configure CORS properly
const allowedOrigins = [
  "http://localhost:3000",
  "https://procoin.vercel.app",
  "http://192.168.32.20:3000"
];

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: false,
//   optionsSuccessStatus: 200
// };

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || true); // return the actual origin if present
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // allow cookies/authorization headers if needed
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ✅ Handle preflight requests for all routes
app.options("*", cors(corsOptions));



// Apply CORS middleware
// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); // Handle preflight requests for all routes
// app.options(/.*/, cors(corsOptions)); // regex works

// ✅ JSON parser
app.use(express.json());

// ✅ Rate limiter (protects your API)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use("/api/", limiter);

// MongoDB connection
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully 🚀'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Email Transaction Model
const transactionEmailSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  amount: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { type: String, default: 'Sent' }
});

const TransactionEmail = mongoose.model('TransactionEmail', transactionEmailSchema);

// Email Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Load Email Templates
const loadTemplate = (name) => {
  const templatePath = path.join(__dirname, `email-templates/${name}.hbs`);
  const content = fs.readFileSync(templatePath, 'utf8');
  return handlebars.compile(content);
};

const templates = {
  binance: loadTemplate('binance'),
  coinbase: loadTemplate('coinbase'),
  bybit: loadTemplate('bybit'),
  cashapp: loadTemplate('cashapp'),
  paypal: loadTemplate('paypal'),
  luno: loadTemplate('luno'),
  zelle: loadTemplate('zelle'),
  okx: loadTemplate('okx'),
  roqqu: loadTemplate('roqqu'),
  bitso: loadTemplate('bitso'),
};

// Routes
// Get all email transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await TransactionEmail.find();
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send email
app.post('/api/send-email', async (req, res) => {
  const { wallet, amount, email, coin, network, walletAddress, message, warning, localcurrency, cashapp_tag, transaction_fee,
     transaction_id,
        recipient_name, senderName
   } = req.body;
  
  // Generate date and time
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // helper to pad single digits with leading zero
  const pad = n => n.toString().padStart(2, "0");

  // build formatted string: YYYY-MM-DD HH:mm:ss
  const dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                   `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`; 

  const options = {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  };

  const prettyFormat = now.toLocaleString("en-US", options).replace(",", "") 
                         .replace(" ", ", ")                                
                         .replace(/ (\d{4}),/, " $1 at");

  try {
    // Save transaction
    const newTransaction = new TransactionEmail({
      wallet,
      amount: `${amount} ${coin}`,
      email,
      date,
      time,
      status: 'Sent'
    });
    await newTransaction.save();

    // Prepare email content
    const templateName = wallet.toLowerCase();
    const html = templates[templateName]({
      amount: `${amount} ${coin}`,
      network,
      walletAddress,
      date: dateTime,
      prettyDate: prettyFormat,
      localcurrency,
      transaction_fee,
      cashapp_tag,
      transaction_id,
      senderName,
      recipient_name,
      warning: warning ? message : null
    });
    
    // Send email
    await transporter.sendMail({
      from: `"${wallet}" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `${wallet} Transaction Confirmation`,
      html
    });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bitso Spanish email
app.post('/api/send-email-bitso-spanish', async (req, res) => {
  const { wallet, amount, email, coin, network, walletAddress, message, warning, localcurrency, cashapp_tag, transaction_fee,
     transaction_id,
        recipient_name, senderName
   } = req.body;
  
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const pad = n => n.toString().padStart(2, "0");
  const dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                   `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`; 
  const options = {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  };
  const prettyFormat = now.toLocaleString("en-US", options).replace(",", "")
                         .replace(" ", ", ")
                         .replace(/ (\d{4}),/, " $1 at");

  try {
    const newTransaction = new TransactionEmail({ wallet, amount: `${amount} ${coin}`, email, date, time, status: 'Sent' });
    await newTransaction.save();

    const templateName = wallet.toLowerCase();
    const html = templates[templateName]({
      amount: `${amount} ${coin}`,
      network,
      walletAddress,
      date: dateTime,
      prettyDate: prettyFormat,
      localcurrency,
      transaction_fee,
      cashapp_tag,
      transaction_id,
      senderName,
      recipient_name,
      warning: warning ? message : null
    });
    
    await transporter.sendMail({
      from: `"${wallet}" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `¡Recibiste un depósito de ${recipient_name}`,
      html
    });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bitso Portuguese email
app.post('/api/send-email-bitso-portugusse', async (req, res) => {
  const { wallet, amount, email, coin, network, walletAddress, message, warning, localcurrency, cashapp_tag, transaction_fee,
     transaction_id,
        recipient_name, senderName
   } = req.body;
  
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const pad = n => n.toString().padStart(2, "0");
  const dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                   `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`; 
  const options = {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  };
  const prettyFormat = now.toLocaleString("en-US", options).replace(",", "")
                         .replace(" ", ", ")
                         .replace(/ (\d{4}),/, " $1 at");

  try {
    const newTransaction = new TransactionEmail({ wallet, amount: `${amount} ${coin}`, email, date, time, status: 'Sent' });
    await newTransaction.save();

    const templateName = wallet.toLowerCase();
    const html = templates[templateName]({
      amount: `${amount} ${coin}`,
      network,
      walletAddress,
      date: dateTime,
      prettyDate: prettyFormat,
      localcurrency,
      transaction_fee,
      cashapp_tag,
      transaction_id,
      senderName,
      recipient_name,
      warning: warning ? message : null
    });
    
    await transporter.sendMail({
      from: `"${wallet}" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `¡Você recebeu um depósito de ${recipient_name}`,
      html
    });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default app;
