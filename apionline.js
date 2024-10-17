const express = require('express');
const app = express();
const port = 3000;

// Sample invoice data
const invoices = [
    { id: 1, customer: 'John Doe', amount: 250.50, dueDate: '2024-10-20' },
    { id: 2, customer: 'Jane Smith', amount: 500.00, dueDate: '2024-11-15' },
    { id: 3, customer: 'Tom Brown', amount: 150.75, dueDate: '2024-12-05' }
];

// Route to get invoices
app.get('/invoices', (req, res) => {
    res.json(invoices);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
