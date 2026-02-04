# 📱 ReelNotes

Transform Instagram Reels into organized, searchable notes with AI-powered extraction and formatting.

![Version](https://img.shields.io/badge/version-1.0.0-red)
![Expo](https://img.shields.io/badge/Expo-54.0-black)
![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)

## ✨ Features

- **🔗 Auto-Extraction** - Paste Instagram reel links and get instant caption extraction
- **🤖 AI Formatting** - Groq AI structures content with sections, bullets, and emojis
- **🎨 Dark Theme** - Sleek black & red interface optimized for readability
- **📝 Smart Notes** - Auto-detects content type (Recipe, Workout, Travel, etc.)
- **💾 Local Storage** - SQLite database for offline access
- **🗑️ Easy Management** - Swipe or tap to delete notes
- **📱 Share Target** - Share reels directly from Instagram app

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Expo Go app (iOS/Android)
- Supabase account (free tier)
- Groq API key (free)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd ReelNotes/app
npm install
```

### 2. Set Up Supabase

#### Create Database

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project
3. Go to SQL Editor and run:

```sql
create table if not exists public.reels (
  id serial primary key,
  url text,
  title text,
  content_type text,
  structured_text text,
  raw_transcript text,
  raw_ocr text,
  status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reels disable row level security;
```

#### Deploy Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy extraction function
cd ../supabase
supabase functions deploy extract-reel

# Set RapidAPI key for Instagram scraping
supabase secrets set RAPID_API_KEY=your_rapidapi_key
```

### 3. Get API Keys

#### Groq AI (Free & Fast)

1. Visit [console.groq.com](https://console.groq.com)
2. Sign up (no credit card needed)
3. Create API key
4. Copy key (starts with `gsk_`)

#### RapidAPI (For Instagram Extraction)

1. Visit [rapidapi.com](https://rapidapi.com)
2. Search for "Instagram Downloader V2"
3. Subscribe to free tier
4. Copy API key

### 4. Configure Environment

Create `app/.env`:

```env
EXPO_PUBLIC_GROQ_API_KEY=gsk_your_groq_key_here
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
```

Create `supabase/.env.local`:

```env
RAPID_API_KEY=your_rapidapi_key_here
```

### 5. Run the App

```bash
cd app
npx expo start
```

Scan QR code with Expo Go app on your phone.

## 📖 Usage

### Adding Notes

1. **From Instagram**: Share reel → Select ReelNotes → Auto-processes
2. **Manual Paste**: Open app → Tap "New" → Paste URL → Auto-extracts
3. **Direct Entry**: Create note manually if extraction fails

### Managing Notes

- **View**: Tap any note card
- **Delete**: Tap ✕ button or long-press card
- **Search**: Use search bar to filter notes
- **Edit**: Open note → Edit structured text → Save

### Content Types

Auto-detected categories:
- 🍳 Recipe
- 💪 Workout
- ✈️ Travel
- 📚 Educational
- 🔨 DIY
- 📌 Other

## 🏗️ Tech Stack

### Frontend
- **React Native** 0.81
- **Expo** 54
- **TypeScript**
- **React Navigation** 7
- **SQLite** (local storage)

### Backend
- **Supabase** (database & edge functions)
- **Groq AI** (LLaMA 3.3 70B)
- **RapidAPI** (Instagram scraping)

### Architecture
```
ReelNotes/
├── app/                    # React Native app
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── screens/       # Main app screens
│   │   ├── services/      # API integrations
│   │   ├── db.ts          # SQLite database
│   │   ├── theme.ts       # Design system
│   │   └── types.ts       # TypeScript types
│   ├── .env               # Environment variables
│   └── package.json
└── supabase/
    ├── functions/
    │   └── extract-reel/  # Edge function for extraction
    ├── schema.sql         # Database schema
    └── .env.local         # Function secrets
```

## 🎨 Design System

### Colors
- **Primary**: `#FF3B3B` (Red)
- **Background**: `#0A0A0A` (Black)
- **Card**: `#1A1A1A` (Dark Gray)
- **Text**: `#FFFFFF` (White)
- **Muted**: `#AAAAAA` (Gray)
- **Border**: `#2A2A2A` (Darker Gray)

### Typography
- **Title**: 24px, 800 weight
- **Heading**: 18px, 700 weight
- **Body**: 16px, 400 weight
- **Caption**: 14px, 600 weight

## 📦 Building for Production

### Android APK

```bash
cd app
eas build --platform android --profile preview
```

### iOS

```bash
eas build --platform ios --profile preview
```

## 🔧 Troubleshooting

### "Invalid API Key" Error
- Check `.env` file has correct keys
- Restart Expo dev server after changing `.env`
- Verify Supabase anon key is correct

### Extraction Not Working
- Ensure Edge Function is deployed: `supabase functions list`
- Check RapidAPI subscription is active
- View function logs: Check Supabase dashboard

### App Won't Open in Expo Go
- Run `npx expo-doctor` to check for issues
- Clear cache: `npx expo start --clear`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- **Groq** for blazing-fast AI inference
- **Supabase** for backend infrastructure
- **Expo** for React Native development platform
- **RapidAPI** for Instagram scraping services

## 📞 Support

Having issues? Check:
- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Groq Documentation](https://console.groq.com/docs)

---

Made with ❤️ using React Native & Expo
