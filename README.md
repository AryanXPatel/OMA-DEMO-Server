<div align="center">
  
  # 🔧 OMA Demo Server
  
  **Express.js backend API server for OMA Order Management App**
  
  [![Node.js](https://img.shields.io/badge/Node.js-18.0-green?style=flat-square&logo=node.js)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-4.18-blue?style=flat-square&logo=express)](https://expressjs.com/)
  [![Google Sheets API](https://img.shields.io/badge/Google%20Sheets-API-green?style=flat-square&logo=googlesheets)](https://developers.google.com/sheets/api)
  [![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
  
  [📱 Frontend App](https://github.com/AryanXPatel/OMA-Order-Management-App) • [🌐 Live API](https://oma-demo-server.onrender.com) • [📊 Database](https://docs.google.com/spreadsheets/d/169NezkhUQScyX95jnTy4vAnT0MqJ27SEiFmJI2N1oL4)
  
</div>

---

## 🎯 **What This Server Does**

The OMA Demo Server is a **RESTful API backend** that powers the Order Management App. It handles all data operations between the React Native frontend and Google Sheets database, providing endpoints for order management, customer data, product catalogs, and approval workflows.

### 🏗️ **System Architecture**

```
📱 React Native App → 🔧 Express API Server → 📊 Google Sheets Database
```

- **Frontend**: [OMA Order Management App](https://github.com/AryanXPatel/OMA-Order-Management-App) (React Native + Expo)
- **Backend**: This repository (Node.js + Express)
- **Database**: [Google Sheets](https://docs.google.com/spreadsheets/d/169NezkhUQScyX95jnTy4vAnT0MqJ27SEiFmJI2N1oL4) integration

---

## 🎮 **What's Been Built - API Endpoints**

### 📋 **1. Order Management APIs**
- **Create New Orders**: `POST /api/sheets/New_Order_Table`
  - Handles order submission from mobile app
  - Supports bulk product insertion
  - Auto-approval for Manager role orders
  - Order ID generation with fiscal year format (2024-2025_00001)

- **Get Orders**: `GET /api/sheets/New_Order_Table!A1:P`
  - Retrieves all order data for tracking
  - Supports order filtering by user role
  - Real-time status updates (Pending/Approved/Rejected/Dispatched)

### 👥 **2. Customer Management APIs**  
- **Get Customers**: `GET /api/sheets/Customer_Master!A1:B`
  - Customer directory with codes and names
  - Search functionality for customer selection
  - Contact information retrieval

- **Customer Ledger**: `GET /api/sheets/Customer_Ledger_2!A1:J`
  - Financial transaction records
  - Credit/Debit balance calculations
  - Order history integration

### 📦 **3. Product Catalog APIs**
- **Get Products**: `GET /api/sheets/Product_Master!A1:E`
  - Complete product inventory
  - Product groups and categories
  - Real-time pricing with Indian number formatting
  - Product codes and specifications

### ✅ **4. Approval & Dispatch APIs**
- **Order Status Updates**: `PUT /api/sheets/New_Order_Table`
  - Manager approval/rejection workflow
  - Dispatch status tracking
  - Comments and reason tracking

---

## 🔧 **Technical Implementation**

### **Built With**
- **Node.js** with Express.js framework
- **Google Sheets API** for database operations
- **CORS** enabled for cross-origin requests
- **Render.com** deployment ready
- **Error handling** with comprehensive logging

### **Key Technical Features**
- **RESTful Design**: Clean API endpoints following REST principles
- **Google Sheets Integration**: Direct API connection without traditional database
- **CORS Configuration**: Supports requests from mobile app and web
- **Performance Optimized**: Efficient data retrieval and caching
- **Error Handling**: Comprehensive error responses and logging
- **Fiscal Year Support**: Order ID generation with financial year logic

---

## 🚀 **Quick Start**

### **Prerequisites**
```bash
Node.js >= 16.0.0
npm >= 8.0.0
Google Cloud Project with Sheets API enabled
```

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/AryanXPatel/OMA-DEMO-SERVER.git
   cd OMA-DEMO-SERVER
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   PORT=3000
   GOOGLE_SHEETS_API_KEY=your_api_key_here
   SHEET_ID=169NezkhUQScyX95jnTy4vAnT0MqJ27SEiFmJI2N1oL4
   ```

4. **Start the server**
   ```bash
   npm start
   ```

   Server runs at: `http://localhost:3000`

---

## 📡 **API Endpoints**

### **Base URLs**
- **Local Development**: `http://localhost:3000`
- **Production**: `https://oma-demo-server.onrender.com`

### **Health Check**
```http
GET /
```
**Response:**
```json
{
  "status": "OMA Demo Server is running!",
  "timestamp": "2024-12-21T10:30:00.000Z"
}
```

### **Order Management**

#### Create New Order
```http
POST /api/sheets/New_Order_Table
Content-Type: application/json

{
  "values": [
    [
      "21/12/2024 02:30 PM",  // SYS-TIME
      "21/12/2024 02:30 PM",  // ORDER-TIME
      "Sales Rep",            // USER
      "Urgent delivery",      // ORDER COMMENTS
      "ABC Industries Ltd",   // CUSTOMER NAME
      "2024-2025_00123",     // ORDER ID
      "Premium Seeds",        // PRODUCT NAME
      "50",                   // QUANTITY
      "Unit",                 // UNIT
      "1,250.00",            // PRODUCT RATE
      "62,500.00",           // ORDER AMOUNT
      "Phone",               // SOURCE
      "R",                   // APPROVED BY MANAGER
      "",                    // MANAGER COMMENTS
      "",                    // ORDER DISPATCHED
      ""                     // DISPATCH COMMENTS
    ]
  ],
  "operation": "append"
}
```

#### Get All Orders
```http
GET /api/sheets/New_Order_Table!A1:P
```

### **Customer Management**

#### Get Customers
```http
GET /api/sheets/Customer_Master!A1:B
```

#### Get Customer Ledger
```http
GET /api/sheets/Customer_Ledger_2!A1:J
```

### **Product Management**

#### Get Products
```http
GET /api/sheets/Product_Master!A1:E
```

---

## 📊 **Google Sheets Integration**

### **Database Structure**

The server connects to a Google Sheets document with these sheets:

| Sheet Name | Purpose | Key Columns |
|------------|---------|-------------|
| `New_Order_Table` | Order lifecycle tracking | SYS-TIME, ORDER-TIME, USER, COMMENTS, CUSTOMER NAME, ORDER ID, PRODUCT NAME, QUANTITY, UNIT, PRODUCT RATE, ORDER AMOUNT, SOURCE, APPROVED BY MANAGER, MANAGER COMMENTS, ORDER DISPATCHED, DISPATCH COMMENTS |
| `Customer_Master` | Customer database | Customer CODE, Customer NAME |
| `Product_Master` | Product catalog | Product GROUP CODE, Product Group Name, Product CODE, Product NAME, Rate |
| `Customer_Ledger_2` | Financial records | Date, Description, Customer Name, Amount, DC (Debit/Credit) |

### **🔗 Database Template**
**Live Database**: [Google Sheets Template](https://docs.google.com/spreadsheets/d/169NezkhUQScyX95jnTy4vAnT0MqJ27SEiFmJI2N1oL4)

---

## 🌐 **Deployment**

### **Render.com Deployment** (Current)

**Live API**: `https://oma-demo-server.onrender.com`

1. **Environment Variables on Render:**
   ```
   PORT=3000
   GOOGLE_SHEETS_API_KEY=your_api_key
   SHEET_ID=169NezkhUQScyX95jnTy4vAnT0MqJ27SEiFmJI2N1oL4
   ```

2. **Build Settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`

### **Local Development**
```bash
# Start development server
npm run dev

# Start production server
npm start
```

---

## 🧪 **Testing the API**

### **Using cURL**

#### Test Server Status
```bash
curl https://oma-demo-server.onrender.com/
```

#### Get Orders
```bash
curl "https://oma-demo-server.onrender.com/api/sheets/New_Order_Table!A1:P"
```

#### Create Order
```bash
curl -X POST "https://oma-demo-server.onrender.com/api/sheets/New_Order_Table" \
  -H "Content-Type: application/json" \
  -d '{
    "values": [
      ["21/12/2024 02:30 PM", "21/12/2024 02:30 PM", "Sales Rep", "Test order", "ABC Industries", "2024-2025_00123", "Premium Seeds", "50", "Unit", "1,250.00", "62,500.00", "Phone", "R", "", "", ""]
    ],
    "operation": "append"
  }'
```

### **Using Browser Console**
```javascript
// Test API from browser
fetch('https://oma-demo-server.onrender.com/')
.then(r => r.json())
.then(data => console.log(data));

// Get customers
fetch('https://oma-demo-server.onrender.com/api/sheets/Customer_Master!A1:B')
.then(r => r.json())
.then(data => console.log(data));
```

### **Using Online Tools**
- **Hoppscotch**: [hoppscotch.io](https://hoppscotch.io/)
- **Postman Web**: For comprehensive API testing
- **Thunder Client**: VS Code extension

---

## 🔄 **API Response Formats**

### **Success Response**
```json
{
  "updates": {
    "spreadsheetId": "169NezkhUQScyX95jnTy4vAnT0MqJ27SEiFmJI2N1oL4",
    "updatedRows": 1,
    "updatedColumns": 16,
    "updatedCells": 16
  }
}
```

### **Error Response**
```json
{
  "error": "Bad Request",
  "message": "Invalid data format",
  "timestamp": "2024-12-21T10:30:00.000Z"
}
```

### **Data Retrieval Response**
```json
{
  "range": "Customer_Master!A1:B",
  "majorDimension": "ROWS",
  "values": [
    ["Customer CODE", "Customer NAME"],
    ["CUST001", "ABC Industries Ltd"],
    ["CUST002", "XYZ Trading Co"]
  ]
}
```

---

## 📁 **Project Structure**

```
OMA-DEMO-SERVER/
├── index.js              # Main server file with all routes
├── package.json          # Dependencies and scripts  
├── .env                  # Environment variables
├── .env.example          # Environment template
├── Procfile             # Render deployment config
└── README.md            # This documentation
```

---

## 🔐 **Security & Performance**

### **Security Features**
- **CORS Configuration**: Properly configured for cross-origin requests
- **Environment Variables**: Secure API key management
- **Input Validation**: Basic request validation
- **Error Handling**: Comprehensive error responses without exposing internals

### **Performance Features**
- **Lightweight**: Minimal dependencies for fast startup
- **Optimized Routes**: Efficient API endpoint handling
- **Error Handling**: Graceful error recovery
- **Request Logging**: Basic request monitoring

---

## 🚀 **Connected Frontend Features**

This server powers these frontend features:

- ✅ **New Order Creation** - Real-time order submission
- ✅ **Customer Search** - Live customer directory access  
- ✅ **Product Catalog** - Dynamic product selection with pricing
- ✅ **Order Tracking** - Personal order history by user role
- ✅ **Manager Approvals** - Order approval/rejection workflow
- ✅ **Dispatch Management** - Order fulfillment tracking
- ✅ **Customer Analytics** - Ledger balance calculations
- ✅ **Dashboard Statistics** - Live order counts and status

---

## 🔮 **Future Enhancements**

- [ ] Authentication middleware
- [ ] Rate limiting implementation  
- [ ] Advanced caching strategies
- [ ] WebSocket support for real-time updates
- [ ] API versioning
- [ ] Comprehensive logging system
- [ ] Database connection pooling
- [ ] API documentation with Swagger

---

## 🐛 **Troubleshooting**

### **Common Issues**

**Server Won't Start**
```bash
# Check if port is in use
netstat -tulpn | grep :3000

# Kill process on port 3000
kill -9 $(lsof -t -i:3000)
```

**Google Sheets API Errors**
- Verify API key is correct in `.env`
- Ensure Sheets API is enabled in Google Cloud Console
- Check sheet permissions (must be publicly readable)
- Verify sheet ID matches the database template

**CORS Errors**
- Check if frontend URL is properly configured
- Verify request headers and methods
- Ensure API endpoints are correctly formatted

**Render Deployment Issues**
- Check environment variables are set on Render
- Verify build and start commands
- Monitor deployment logs for errors

---

## 🤝 **Contributing**

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/api-improvement`)
3. Commit your changes (`git commit -m 'Add new API endpoint'`)
4. Push to the branch (`git push origin feature/api-improvement`)
5. Open a Pull Request

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 **Related Links**

- **📱 Frontend Repository**: [OMA-Order-Management-App](https://github.com/AryanXPatel/OMA-Order-Management-App)
- **📊 Google Sheets Database**: [Live Database](https://docs.google.com/spreadsheets/d/169NezkhUQScyX95jnTy4vAnT0MqJ27SEiFmJI2N1oL4)
- **🌐 Web App Demo**: [oma-order-management-app.vercel.app](https://oma-order-management-app.vercel.app)
- **📱 APK Downloads**: [Mobile App Releases](https://github.com/AryanXPatel/OMA-Order-Management-App/releases)

---

## 👨‍💻 **Developer**

**Aryan Patel**
- GitHub: [@AryanXPatel](https://github.com/AryanXPatel)
- LinkedIn: [Connect with me](https://linkedin.com/in/aryanxpatel)

---

<div align="center">
  
  **⚡ Powering efficient order management**
  
  [![API Status](https://img.shields.io/badge/API-Online-green.svg?style=for-the-badge)](https://oma-demo-server.onrender.com)
  
  Made with ❤️ for seamless order processing
  
</div>
