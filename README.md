# UZB Taxi — Oddiy, Tez va Ishonchli

UZB Taxi — O‘zbekiston uchun mo‘ljallangan taksi xizmati (starter) loyihasi. Ushbu README loyihaning arxitekturasi, o‘rnatish va ishga tushirish bo‘yicha ko‘rsatmalar, asosiy API va komponentlar haqida ma’lumot beradi. Maqsad — tez prototip tayyorlash va keyinchalik kengaytirish.

## Asosiy xususiyatlar
- Foydalanuvchi (Passenger) va Haydovchi (Driver) rollari
- Buyurtma berish: manzil tanlash va narx hisoblash
- Realtime holat yangilanishi (Socket.IO)
- Autentifikatsiya (JWT)
- Administrator paneli (statistika, buyurtmalarni kuzatish)
- Geolocation yangilanishlari va marshrutlar
- Push bildirishnomalari (FCM)

## Texnologik stack (tavsiya)
- Backend: Node.js + Express (TypeScript tavsiya etiladi)
- Realtime: Socket.IO
- Maʼlumotlar bazasi: PostgreSQL
- Frontend (web admin): React
- Mobil ilova: React Native (yoki Flutter)
- Oraliq qatlamlar: Redis (keşlash / Session / rate limiting)
- Docker & docker-compose yordamida konteynerlash

## Monorepo tuzilishi (tavsiya)
- /backend — Express API
- /frontend — React admin dashboard
- /mobile — React Native ilova (passenger/driver)
- /infra — docker-compose, nginx, certs va boshqalar

## Tez boshlash (Docker yordamida)

1. Repo klonlash:
```
git clone https://github.com/fayzullogayzullo-cloud/Dehqonchilik_sirlari.git uzb-taxi
cd uzb-taxi
```

2. infra katalogida docker-compose misoli (tavsiya):
```
# infra/docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: taxi
      POSTGRES_PASSWORD: taxi_pass
      POSTGRES_DB: uzb_taxi
    volumes:
      - db-data:/var/lib/postgresql/data
  redis:
    image: redis:7
  backend:
    build: ../backend
    environment:
      DATABASE_URL: postgres://taxi:taxi_pass@db:5432/uzb_taxi
      REDIS_URL: redis://redis:6379
      JWT_SECRET: change_me
    depends_on:
      - db
      - redis
    ports:
      - "8000:8000"
  frontend:
    build: ../frontend
    ports:
      - "3000:3000"
volumes:
  db-data:
```

3. Docker orqali ishga tushirish:
```
cd infra
docker-compose up --build
```

## Muqobil: mahalliy rivojlantirish (Node.js)

1. Backend uchun:
```
cd backend
cp .env.example .env
# .env ichida DATABASE_URL, JWT_SECRET, FCM_SERVER_KEY va boshqalarni to'ldiring
npm install
npm run migrate   # agar migration tizimingiz bo'lsa
npm run dev
```

2. Frontend uchun:
```
cd frontend
npm install
npm start
```

## Muhim muhit o‘zgaruvchilari (.env misoli)
```
PORT=8000
DATABASE_URL=postgres://taxi:taxi_pass@localhost:5432/uzb_taxi
REDIS_URL=redis://localhost:6379
JWT_SECRET=some_long_random_secret
FCM_SERVER_KEY=AAA...
GOOGLE_MAPS_API_KEY=AIza...
```

## API (namuna)
- POST /api/v1/auth/register — ro‘yxatdan o‘tish
  - body: { name, phone, password, role: "passenger"|"driver" }
- POST /api/v1/auth/login — kirish
  - returns: { token }
- POST /api/v1/rides — yangi buyurtma (passenger)
  - body: { from: {lat, lng}, to: {lat, lng}, paymentMethod }
- GET /api/v1/rides/:id — buyurtma holati
- POST /api/v1/drivers/:id/location — haydovchi joylashuvini yangilash
- Websocket (Socket.IO): channellar — ride_updates, driver_locations

## Narx (fare) hisoblash (oddiy formulalar)
- Bazaviy: base_fare + (distance_km * per_km) + (duration_min * per_min)
- Qo‘shimcha: tungi narx, xizmat solig‘i, chegirma kuponlari

## Realtime & Bildirishnomalar
- Socket.IO server: haydovchilar va mijozlar o‘rtasida voqealar (offer, accept, update, cancel)
- FCM: buyurtma qabul qilinishi, haydovchi kelishi, chegirma va boshqalar

## Test va seed
- seed script: test foydalanuvchilar, haydovchilar va namunaviy buyurtmalar
- unit/integration testlar: Jest (backend), React Testing Library (frontend)

## Xavfsizlik va maxfiylik
- Parollarni bcrypt bilan xesh qilish
- JWT tokenlar uchun short expiry va refresh token mexanizmi
- HTTPS ga majbur qilish (nginx + certbot)
- Rate limiting (express-rate-limit) va input validation (Joi/zod)

## Qo‘shimcha takliflar / Roadmap
- To‘lov integratsiyasi (Click, Payme, Stripe)
- Qo‘ng‘iroq va chat funksiyasi haydovchi-mijoz o‘rtasida
- Qo‘shimcha analytics va qiymatli metriclar
- Mashina turini tanlash (ekonom, comfort, premium)
- AI asosida narx optimallashtirish va dinamik narxlash

## Hissa qo‘shish
1. Fork qiling
2. Yangi branch oching: git checkout -b feat/your-feature
3. O‘zgartirishlar qiling va push qiling
4. Pull request yuboring

## Litsenziya
MIT License — orqaga mos mualliflik shartlariga rioya qiling.

## Aloqa
Loyiha muallifi: fayzullogayzullo-cloud  
Email: (o'zgartiring) your-email@example.com
