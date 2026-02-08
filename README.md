# Health Tracker App

A personal health tracking app for your Zepbound weight loss journey.

---

## 📱 Getting the App on Your Phone

### Option 1: Quick Test (Expo Go) - Easiest
*Best for: Testing and development*

1. Download **Expo Go** from the App Store
2. Run `npx expo start` in the project folder
3. Scan the QR code with your iPhone camera
4. App opens in Expo Go

**Downside**: You need your computer running and must scan QR each time.

---

### Option 2: Development Build - Recommended
*Best for: Daily use while still developing*

This installs a real app on your phone that auto-connects to your dev server.

**First-time setup:**
```powershell
# 1. Install EAS CLI (one time only)
npm install -g eas-cli

# 2. Login to Expo (free account)
eas login

# 3. Build for your iPhone
eas build --profile development --platform ios
```

When the build finishes (~15 mins), you'll get a link. Open it on your iPhone to install.

**After installation:**
- Just run `npx expo start` on your computer
- Open the HealthTracker app on your phone
- It connects automatically!

---

### Option 3: Standalone App (No Computer Needed)
*Best for: Finished app you use daily*

**Requirements:** Apple Developer Account ($99/year)

```powershell
# Build a production app
eas build --profile production --platform ios --auto-submit
```

This submits to TestFlight. Once approved (~24 hours), install from TestFlight app.

---

### Option 4: Simulator (Testing on Mac)
*Best for: If you have a Mac*

```powershell
npx expo start --ios
```

Opens in iPhone Simulator automatically.

---

## 🚀 Quick Start

### First Time Setup
```powershell
cd "C:\Users\fairy\OneDrive\Desktop\HealthTracker"
npm install
npx expo start
```

### Daily Usage
```powershell
cd "C:\Users\fairy\OneDrive\Desktop\HealthTracker"
npx expo start
```
Then open the app on your phone.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | See current weight, trends, and quick actions |
| **Weight Tracking** | Log daily weigh-ins with notes |
| **Body Measurements** | Track chest, waist, hips, arms, thighs, neck |
| **Zepbound Tracker** | Log shots, track doses, see next shot date |
| **Charts** | Weight, measurements, and Zepbound progress visualized |
| **AI Chat** | Get personalized advice (10 messages/hour) |
| **Insights** | AI-generated health insights from your data |
| **Themes** | 6 color themes to personalize your app |

---

## 📱 Navigation

**Bottom Tabs (5):**
- 🏠 **Home** - Dashboard with overview and quick actions
- ➕ **Log** - Add weight entries
- 📈 **Progress** - View charts and trends
- 💬 **Coach** - AI health assistant
- 💊 **Meds** - Zepbound shot tracking

**From Dashboard:**
- **Log Weight** - Quick add weight entry
- **Measure** - Body measurements
- **Insights** - AI analysis of your data
- **Settings** - Themes, profile, cloud sync

---

## 🔧 Troubleshooting

### "Can't connect to Metro server"
```powershell
# Kill all node processes and restart
taskkill /F /IM node.exe
npx expo start --clear
```

### "Network request failed"
- Make sure iPhone and computer are on the **same WiFi**
- Try tunnel mode: `npx expo start --tunnel`

### "App crashes on launch"
- Update Expo Go from App Store
- Clear cache: `npx expo start --clear`

### "Dependencies issues"
```powershell
rm -r node_modules
npm install --legacy-peer-deps
```

---

## 🛡️ Privacy

All data stays on your device. Nothing is sent to external servers.
- Weights, measurements, and shots stored in local SQLite database
- AI chat uses AIML API (messages are not stored)

---

## ☁️ Cloud Sync Setup (Optional)

Want to backup your data and sync across devices? Set up AWS Cognito (free for first 50,000 users/month).

### Step 1: Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com) and create a free account
2. Sign in to the AWS Console

### Step 2: Create Cognito User Pool
1. In AWS Console, search for **"Cognito"**
2. Click **"Create user pool"**
3. Configure sign-in:
   - Check **Email** as sign-in option
   - Click **Next**
4. Security requirements:
   - Password policy: Choose **Cognito defaults** (or customize)
   - No MFA (simpler) or enable if you want extra security
   - Click **Next**
5. Sign-up experience:
   - Self-registration: **Enable**
   - Allow Cognito to verify: Check **Email**
   - Click **Next**
6. Message delivery:
   - Email provider: **Send with Cognito** (simplest)
   - Click **Next**
7. App integration:
   - User pool name: `HealthTrackerUsers`
   - App client name: `HealthTrackerApp`
   - Client secret: **Don't generate** (important!)
   - Click **Next**
8. Review and click **Create user pool**

### Step 3: Get Your Credentials
1. Open your new user pool
2. Copy the **User pool ID** (looks like: `us-east-1_aBcDeFgHi`)
3. Go to **App integration** tab → **App client list**
4. Copy the **Client ID** (looks like: `1abc2defghijk3lmnop4qrst5u`)

### Step 4: Update Your App
Edit `src/aws/amplifyConfigure.ts`:
```typescript
aws_user_pools_id: 'us-east-1_YOUR_POOL_ID',      // Paste your User Pool ID
aws_user_pools_web_client_id: 'YOUR_CLIENT_ID',   // Paste your Client ID
```

### Step 5: Restart the App
```powershell
npx expo start --clear
```

Now the Sign In button in Settings will work!

---

## 📁 Project Structure

```
HealthTracker/
├── App.tsx              # Main app entry
├── src/
│   ├── screens/         # All app screens
│   ├── database/        # SQLite database
│   ├── theme/           # Colors and themes
│   ├── services/        # AI service
│   └── aws/             # Cloud sync (optional)
└── assets/              # Images and icons
```

---

## 🔮 Planned Features

- [ ] Apple Health sync
- [ ] Shot reminder notifications  
- [ ] Progress photo gallery
- [ ] Cloud backup across devices
- [ ] Export data to PDF/CSV

---

*Built with React Native + Expo for iOS*
