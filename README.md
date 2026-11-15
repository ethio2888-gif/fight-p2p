# 🥊 Fight P2P

**Premium Peer-to-Peer Boxing Match Prediction Platform**

Fight P2P is a secure, scalable entertainment platform where boxing fans can predict match outcomes using virtual points. No real money is involved.

## ✨ Features

- 🔐 **Secure Authentication** - JWT-based auth with bcrypt password hashing
- 🎯 **Peer-to-Peer Predictions** - Predict against other users, not the house
- 💰 **Virtual Points System** - 1,000 starting points, daily 50-point bonus
- 🛡️ **Security First** - Rate limiting, input validation, XSS protection, atomic operations
- 🚀 **High Traffic Ready** - MongoDB indexes, query limits, race condition prevention
- 📊 **Leaderboard** - Top fighters ranking
- 📢 **Ad Integration** - Adsterra advertising support
- 🔑 **Progressive KYC** - Identity verification for high-value predictions (>5,000 points)
- 🤖 **reCAPTCHA** - Bot prevention on registration
- ☁️ **Cloudinary Uploads** - Secure image uploads for admin

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Authentication:** JWT, bcryptjs
- **Real-time:** Socket.io
- **File Upload:** Multer + Cloudinary
- **Security:** express-rate-limit, reCAPTCHA
- **Frontend:** Vanilla HTML/CSS/JS (Glassmorphism UI)

## 📦 Installation

```bash
git clone https://github.com/ethio2888-gif/fight-p2p.git
cd fight-p2p
npm install
```

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
PORT=10000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

## 🚀 Running the App

```bash
# Development
npm run dev

# Production
npm start
```

## 📁 Project Structure
