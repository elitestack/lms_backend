import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors'; 


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',  // allow frontend
  methods: ['GET','POST'],          // allowed methods
  allowedHeaders: ['Content-Type']  // allowed headers
}));



  // MongoDB Connection
const uri = process.env.MONGODB_URI;

mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});


// Transaction Model
const transactionEmailSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  amount: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { type: String, default: 'Sent' }
});

const TransactionEmail = mongoose.model('Transaction', transactionEmailSchema);

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
// Get all transactions
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

  // const now = new Date();

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

const prettyFormat = now.toLocaleString("en-US", options).replace(",", "") // "Mon Aug 18 2025, 12:59 PM"
                       .replace(" ", ", ")                                // "Mon, Aug 18 2025, 12:59 PM"
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








app.post('/api/send-email-bitso-spanish', async (req, res) => {
  const { wallet, amount, email, coin, network, walletAddress, message, warning, localcurrency, cashapp_tag, transaction_fee,
     transaction_id,
        recipient_name, senderName
   } = req.body;
  
  // Generate date and time
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // const now = new Date();

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

const prettyFormat = now.toLocaleString("en-US", options).replace(",", "") // "Mon Aug 18 2025, 12:59 PM"
                       .replace(" ", ", ")                                // "Mon, Aug 18 2025, 12:59 PM"
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
      subject: `¡Recibiste un depósito de ${recipient_name}`,
      html
    });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});




app.post('/api/send-email-bitso-portugusse', async (req, res) => {
  const { wallet, amount, email, coin, network, walletAddress, message, warning, localcurrency, cashapp_tag, transaction_fee,
     transaction_id,
        recipient_name, senderName
   } = req.body;
  
  // Generate date and time
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // const now = new Date();

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

const prettyFormat = now.toLocaleString("en-US", options).replace(",", "") // "Mon Aug 18 2025, 12:59 PM"
                       .replace(" ", ", ")                                // "Mon, Aug 18 2025, 12:59 PM"
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
      subject: `¡Você recebeu um depósito de ${recipient_name}`,
      html
    });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



export default app;

// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));