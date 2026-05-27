# WellNest

WellNest is a simple health and wellbeing tracking platform for II2210 Teknologi Platform Assignment 2. It supports account registration and approval, JWT login, role-based dashboards, user progress uploads with media, admin feedback, and public health alerts from OpenFDA.

## Tech Stack

- Backend: Node.js, Express
- Frontend: static HTML, CSS, JavaScript in `public/`
- Database: MySQL or MariaDB
- Authentication: JWT
- File upload: multer
- Public API integration: OpenFDA

## Folder Structure

```text
wellnest-app/
+-- server.js              # Express server and API routes
+-- public/
|   +-- index.html         # Main frontend page
|   +-- script.js          # Frontend logic
|   +-- style.css          # Frontend styling
+-- uploads/
|   +-- .gitkeep           # Keeps uploads folder in git
+-- schema.sql             # Initial database schema
+-- migrate_tugas2.sql     # Assignment 2 database migration
+-- package.json           # Node.js scripts and dependencies
+-- package-lock.json      # Locked dependency versions
+-- .env.example           # Example environment configuration
+-- .gitignore             # Ignored local/generated files
+-- .htaccess              # Hosting/server helper config
```

## Environment Variables

Create a local `.env` file based on `.env.example`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=wellnest_user
DB_PASSWORD=YOUR_DATABASE_PASSWORD_HERE
DB_NAME=wellnest_db
JWT_SECRET=change_this_secret_key
JWT_EXPIRES_IN=1d
```

Do not commit `.env` because it contains server credentials and secrets.

## Install Dependencies

```bash
npm install
```

## Run the Server

```bash
npm start
```

By default, the app runs on:

```text
http://localhost:3000
```

## Database Setup

Import the SQL files into MySQL/MariaDB:

```bash
mysql -u wellnest_user -p wellnest_db < schema.sql
mysql -u wellnest_user -p wellnest_db < migrate_tugas2.sql
```

Use the database name, username, and password that match your `.env` file.

## Deploy Updates on aaPanel VM

On the aaPanel Ubuntu VM, SSH into the server and go to the project directory:

```bash
cd /path/to/wellnest-app
git pull
npm install
```

Then restart the Node.js app from aaPanel or with the process manager used on the VM. If only frontend files changed, `git pull` and restart are usually enough.

## Notes

- Uploaded files are stored in `uploads/` and should not be committed.
- Keep API endpoint paths unchanged because the frontend and backend depend on them.
- The frontend is intentionally plain HTML/CSS/JS to keep deployment simple.
