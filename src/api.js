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


router.get("/", (req, res) => {
  res.json(invoices);
});


app.use(`/invoices`, router);

module.exports = app;
module.exports.handler = serverless(app);
