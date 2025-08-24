# Astrolune Backend API

Современный, безопасный и масштабируемый Backend API для проекта Astrolune, построенный на Node.js, Express и TypeScript.

## 🚀 Особенности

- **TypeScript** - полная типизация для лучшей разработки
- **Современная архитектура** - Singleton паттерны, dependency injection
- **Безопасность** - Helmet, CORS, rate limiting, валидация входных данных
- **Логирование** - Winston с ротацией файлов и структурированными логами
- **Аутентификация** - JWT токены с cookie поддержкой
- **Валидация** - express-validator для всех входных данных
- **База данных** - MongoDB с Mongoose ODM
- **Error Handling** - Централизованная обработка ошибок
- **Graceful Shutdown** - Корректное завершение процессов

## 📁 Структура проекта

```
src/
├── auth/                          # Модуль аутентификации
│   ├── controllers/               # Контроллеры аутентификации
│   │   ├── auth.controller.ts     # Основной контроллер аутентификации
│   │   ├── password.controller.ts # Контроллер смены паролей
│   │   └── recovery.controller.ts # Контроллер восстановления паролей
│   ├── routes/                    # Маршруты аутентификации
│   │   ├── auth.routes.ts         # Основные маршруты аутентификации
│   │   └── recovery.routes.ts     # Маршруты восстановления
│   ├── services/                  # Сервисы аутентификации
│   │   ├── auth.service.ts        # Основной сервис аутентификации
│   │   ├── email.service.ts       # Сервис отправки email
│   │   └── recovery.service.ts    # Сервис восстановления паролей
│   └── validators/                # Валидаторы данных
│       ├── auth.validator.ts      # Валидация аутентификации
│       └── recovery.validator.ts  # Валидация восстановления
├── config/                        # Конфигурации
│   ├── app.config.ts             # Основная конфигурация приложения
│   ├── auth.config.ts            # Конфигурация аутентификации
│   ├── database.config.ts        # Конфигурация базы данных
│   ├── email.config.ts           # Конфигурация email
│   └── security.config.ts        # Конфигурация безопасности
├── constants/                     # Константы
│   └── error-codes.ts            # Коды ошибок
├── interfaces/                    # TypeScript интерфейсы
│   └── user.interface.ts         # Интерфейс пользователя
├── middlewares/                   # Middleware функции
│   ├── auth.middleware.ts        # Middleware аутентификации
│   ├── error.middleware.ts       # Обработчик ошибок
│   └── logging.middleware.ts     # Middleware логирования
├── models/                        # Mongoose модели
│   ├── recovery-code.model.ts    # Модель кодов восстановления
│   └── user.model.ts             # Модель пользователя
├── types/                         # Типы TypeScript
│   ├── email.ts                  # Типы email
│   ├── express.d.ts              # Расширения Express
│   └── jwt.ts                    # JWT типы
├── utils/                         # Утилиты
│   ├── api-response.ts           # Стандартизированные ответы API
│   ├── app-error.ts              # Класс ошибок приложения
│   ├── async-handler.ts          # Обертка для async функций
│   ├── database.ts               # Утилиты базы данных
│   ├── logger.ts                 # Система логирования
│   └── security.ts               # Утилиты безопасности
├── templates/                     # Email шаблоны
│   └── passwordReset.html        # Шаблон сброса пароля
├── app.ts                        # Основной класс приложения
├── index.ts                      # Точка входа приложения
└── routes/                       # Главные маршруты
    └── index.ts                  # Основной роутер
```

## 🛠 Технологический стек

- **Node.js** 18+
- **TypeScript** 5+
- **Express.js** 4+
- **MongoDB** 6+
- **Mongoose** 8+
- **JWT** для аутентификации
- **bcryptjs** для хеширования паролей
- **Winston** для логирования
- **Helmet** для безопасности
- **express-rate-limit** для ограничения запросов

## 🚦 Начало работы

### Требования

- Node.js 18 или выше
- MongoDB 6 или выше
- npm или yarn

### Установка

1. Клонирование репозитория
```bash
git clone <repository-url>
cd astrolune-backend
```

2. Установка зависимостей
```bash
npm install
```

3. Настройка переменных окружения
```bash
cp .env.example .env
```

4. Настройка `.env` файла:
```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGO_URI=mongodb://localhost:27017/astrolune

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
JWT_ISSUER=astrolune-api
JWT_AUDIENCE=astrolune-client

# Email (для восстановления паролей)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@astrolune.ru

# Security
BCRYPT_SALT_ROUNDS=12
PASSWORD_MIN_LENGTH=8
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Cookies
COOKIE_DOMAIN=localhost
```

### Запуск

1. Режим разработки:
```bash
npm run dev
```

2. Продакшн:
```bash
npm run build
npm start
```

3. Тестирование:
```bash
npm test
```

## 📡 API Endpoints

### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/v1/auth/register` | Регистрация пользователя |
| POST | `/api/v1/auth/login` | Вход в систему |
| POST | `/api/v1/auth/logout` | Выход из системы |
| GET | `/api/v1/auth/me` | Получение текущего пользователя |
| PATCH | `/api/v1/auth/profile` | Обновление профиля |