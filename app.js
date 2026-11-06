require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fixit-campus-development-secret',
  resave: false,
  saveUninitialized: false
}));

const routes = require('./routes/index');
const offices = require('./config/offices');
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  const recipientEmails = [
    process.env.IT_DEPARTMENT_EMAIL || 'it.sherubtse@rub.edu.bt',
    process.env.DEAN_ACADEMIC_EMAIL || 'deanacademic.sherubtse@rub.edu.bt',
    process.env.DEAN_STUDENT_EMAIL || 'deanstudent.sherubtse@rub.edu.bt',
    process.env.PRESIDENT_EMAIL || 'president.sherubtse@rub.edu.bt',
    process.env.FINA_PRESIDENT_EMAIL || 'finapresident.sherubtse@rub.edu.bt'
  ].map(email => email.toLowerCase());
  res.locals.isFeedbackRecipient = Boolean(req.session.user && recipientEmails.includes(req.session.user.email.toLowerCase()));
  res.locals.officeDashboard = offices.forUser(req.session.user);
  next();
});
app.use('/', routes);
app.use((req, res) => res.status(404).render('not-found', { title: 'Page Not Found' }));

const PORT = 3000;
if (require.main === module) app.listen(PORT, () => console.log(`FixIt Campus running at http://localhost:${PORT}`));
module.exports = app;
