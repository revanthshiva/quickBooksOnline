const express = require("express");
const serverless = require("serverless-http");

const app = express();
const router = express.Router();

// Sample invoice data
const invoices = [
  { id: 1, customer: 'John Doe', amount: 250.50, dueDate: '2024-10-20' },
  { id: 2, customer: 'Jane Smith', amount: 500.00, dueDate: '2024-11-15' },
  { id: 3, customer: 'Tom Brown', amount: 150.75, dueDate: '2024-12-05' }
];

// Route to get invoices
router.get("/", (req, res) => {
  res.json(invoices);
});

// Use the router under /invoices path
app.use("/invoices", router);

// Export the app and the serverless handler
module.exports = app;
module.exports.handler = serverless(app);
