// Designated offices that have their own private dashboard.
// A complaint sent to one of these recipients appears ONLY on that office's
// dashboard. The dashboard opens for the account whose role is that office
// (President / Fina President / DAA / IT Department / DSA) or whose email matches the address in .env.
const offices = [
  {
    key: 'president',
    view: 'president-dashboard',
    short: 'President',
    recipient: 'President',
    role: 'president',
    label: 'President Dashboard',
    path: '/president/dashboard',
    email: (process.env.PRESIDENT_EMAIL || 'president.sherubtse@rub.edu.bt').toLowerCase()
  },
  {
    key: 'fina',
    view: 'fina-president-dashboard',
    short: 'Fina President',
    recipient: 'Fina President',
    role: 'fina presedent',
    label: 'Fina President Dashboard',
    path: '/fina/dashboard',
    email: (process.env.FINA_PRESIDENT_EMAIL || 'finapresident.sherubtse@rub.edu.bt').toLowerCase()
  },
  {
    key: 'daa',
    view: 'daa-dashboard',
    short: 'DAA',
    recipient: 'Dean of Academic Affairs',
    role: 'dean of accademic affair',
    label: 'DAA Dashboard',
    path: '/daa/dashboard',
    email: (process.env.DEAN_ACADEMIC_EMAIL || 'deanacademic.sherubtse@rub.edu.bt').toLowerCase()
  },
  {
    key: 'it',
    view: 'it-dashboard',
    short: 'IT',
    recipient: 'IT Department',
    role: 'it department',
    label: 'IT Department Dashboard',
    path: '/it/dashboard',
    email: (process.env.IT_DEPARTMENT_EMAIL || 'it.sherubtse@rub.edu.bt').toLowerCase()
  },
  {
    key: 'dsa',
    view: 'dsa-dashboard',
    short: 'DSA',
    recipient: 'Dean of Student Affairs',
    role: 'dean of student affair',
    label: 'DSA Dashboard',
    path: '/dsa/dashboard',
    email: (process.env.DEAN_STUDENT_EMAIL || 'deanstudent.sherubtse@rub.edu.bt').toLowerCase()
  }
];

// Find the office dashboard that belongs to a signed-in user (by email or role).
offices.forUser = user => user
  ? offices.find(o => o.email === String(user.email || '').toLowerCase() || o.role === user.role) || null
  : null;

module.exports = offices;
