const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const router = express.Router();
const offices = require('../config/offices');

const issuesFile = path.join(__dirname, '..', 'data', 'issues.json');
const usersFile = path.join(__dirname, '..', 'data', 'users.json');
const feedbackFile = path.join(__dirname, '..', 'data', 'feedback.json');

const feedbackRecipients = {
  'IT Department': process.env.IT_DEPARTMENT_EMAIL || 'it.sherubtse@rub.edu.bt',
  'Dean of Academic Affairs': process.env.DEAN_ACADEMIC_EMAIL || 'deanacademic.sherubtse@rub.edu.bt',
  'Dean of Student Affairs': process.env.DEAN_STUDENT_EMAIL || 'deanstudent.sherubtse@rub.edu.bt',
  'President': process.env.PRESIDENT_EMAIL || 'president.sherubtse@rub.edu.bt',
  'Fina President': process.env.FINA_PRESIDENT_EMAIL || 'finapresident.sherubtse@rub.edu.bt'
};

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const roles = [
  'student',
  'president',
  'fina presedent',
  'dean of accademic affair',
  'dean of student affair',
  'it department',
  'faculty',
  'supporting staff',
  'non supporting staff'
];

const studentEmailPattern = /^\d{8}\.sherubtse@rub\.edu\.bt$/i;
const campusStaffEmailPattern = /^[a-z][a-z0-9._-]*\.sherubtse@rub\.edu\.bt$/i;

function validCollegeEmail(email, role) {
  if (role === 'student') {
    return studentEmailPattern.test(email);
  }

  return campusStaffEmailPattern.test(email);
}

// Complaints a signed-in user has sent through the feedback form (with any responses).
function myComplaints(email) {
  return read(feedbackFile)
    .filter(item => String(item.senderEmail).toLowerCase() === String(email).toLowerCase())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function signedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  next();
}

function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
      return res.status(403).render('not-found', {
        title: 'Access Denied',
        message: 'You do not have permission to view this page.'
      });
    }

    next();
  };
}

function dashboardFor(role, email) {
  const office = offices.forUser({ role, email });

  if (office) {
    return office.path;
  }

  if (role === 'student') {
    return '/student/dashboard';
  }

  if (role === 'faculty') {
    return '/faculty/dashboard';
  }

  return '/staff';
}

router.get('/', (req, res) => {
  const issues = read(issuesFile);

  res.render('index', {
    title: 'FixIt Campus | Home',
    issues,
    stats: {
      total: issues.length,
      open: issues.filter(issue => issue.status !== 'Resolved').length,
      progress: issues.filter(issue => issue.status === 'In Progress').length,
      resolved: issues.filter(issue => issue.status === 'Resolved').length
    }
  });
});

router.get('/issues', (req, res) => {
  const issues = read(issuesFile).sort((a, b) => b.id - a.id);

  res.render('issues', {
    title: 'Reported Issues | FixIt Campus',
    issues,
    query: req.query
  });
});

router.get('/report', signedIn, (req, res) => {
  res.render('report', {
    title: 'Report an Issue | FixIt Campus',
    error: null
  });
});

router.post('/report', signedIn, (req, res) => {
  const { title, category, location, description, priority, sendBackTo } = req.body;

  if (!title || !category || !location || !description || !['President', 'Dean of Academic Affairs', 'Dean of Student Affairs', 'IT Department'].includes(sendBackTo)) {
    return res.status(400).render('report', {
      title: 'Report an Issue | FixIt Campus',
      error: 'Please complete all required fields.'
    });
  }

  const issues = read(issuesFile);
  const nextId = Math.max(1000, ...issues.map(issue => Number(issue.id))) + 1;

  issues.push({
    id: nextId,
    title: title.trim(),
    category,
    location: location.trim(),
    sendBackTo,
    description: description.trim(),
    priority: ['Low', 'Medium', 'High'].includes(priority) ? priority : 'Medium',
    status: 'Submitted',
    reporter: req.session.user.name,
    reporterEmail: req.session.user.email,
    createdAt: new Date().toISOString().slice(0, 10),
    assignedTo: 'Awaiting assignment'
  });

  save(issuesFile, issues);
  res.redirect(`/issues?submitted=${nextId}`);
});

// Separate Unit / Club / Network feedback channel.
router.get('/feedback', signedIn, (req, res) => {
  res.render('feedback', {
    title: 'Unit, Club & Network Feedback | FixIt Campus',
    error: null,
    query: req.query,
    formData: { title: '', category: 'Unit / Club / Network', recipient: 'Fina President', description: '' },
    recipients: Object.keys(feedbackRecipients)
  });
});

router.post('/feedback', signedIn, (req, res) => {
  const title = (req.body.title || '').trim();
  const category = (req.body.category || '').trim();
  const recipient = (req.body.recipient || '').trim();
  const description = (req.body.description || '').trim();
  const formData = { title, category, recipient, description };
  const fromDashboard = req.body.returnTo === 'student' && req.session.user.role === 'student';
  const showError = message => {
    if (fromDashboard) {
      return renderStudentDashboard(req, res, { feedbackError: message, feedbackForm: formData, feedbackSent: null }, 400);
    }

    return res.status(400).render('feedback', {
      title: 'Unit, Club & Network Feedback | FixIt Campus',
      error: message,
      query: {},
      formData,
      recipients: Object.keys(feedbackRecipients)
    });
  };

  if (!title || !category || !recipient || !description) {
    return showError('Please complete all required fields.');
  }

  if (!Object.prototype.hasOwnProperty.call(feedbackRecipients, recipient)) {
    return showError('Please select a valid recipient.');
  }

  const feedback = read(feedbackFile);
  const nextId = Math.max(2000, ...feedback.map(item => Number(item.id) || 0)) + 1;

  feedback.push({
    id: nextId,
    title,
    category,
    recipient,
    recipientEmail: feedbackRecipients[recipient].toLowerCase(),
    description,
    status: 'New',
    senderName: req.session.user.name,
    senderEmail: req.session.user.email,
    createdAt: new Date().toISOString()
  });

  save(feedbackFile, feedback);
  if (fromDashboard) {
    return res.redirect(`/student/dashboard?feedbackSent=${nextId}#send-feedback`);
  }

  res.redirect(`/feedback?submitted=${nextId}`);
});

router.get('/feedback/inbox', signedIn, (req, res) => {
  const authorizedRecipient = Object.entries(feedbackRecipients).find(([, email]) =>
    email.toLowerCase() === req.session.user.email.toLowerCase()
  );

  if (!authorizedRecipient) {
    return res.status(403).render('not-found', {
      title: 'Private Feedback Inbox',
      message: 'This inbox is restricted to the designated recipient account. Sign in with the official account assigned to this office.'
    });
  }

  const [recipientName, recipientEmail] = authorizedRecipient;
  const query = (req.query.q || '').trim().toLowerCase();
  const status = (req.query.status || '').trim();
  const feedback = read(feedbackFile)
    .filter(item => item.recipientEmail.toLowerCase() === recipientEmail.toLowerCase())
    .filter(item => !status || item.status === status)
    .filter(item => !query || [item.title, item.description, item.category, item.senderName, item.senderEmail]
      .some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('feedback-inbox', {
    title: `${recipientName} Inbox | FixIt Campus`,
    feedback,
    recipientName,
    query: req.query,
    total: read(feedbackFile).filter(item => item.recipientEmail.toLowerCase() === recipientEmail.toLowerCase()).length
  });
});

router.post('/feedback/:id/status', signedIn, (req, res) => {
  const authorizedRecipient = Object.entries(feedbackRecipients).find(([, email]) =>
    email.toLowerCase() === req.session.user.email.toLowerCase()
  );

  if (!authorizedRecipient) {
    return res.status(403).render('not-found', {
      title: 'Access Denied',
      message: 'Only the designated recipient can update this feedback.'
    });
  }

  const recipientEmail = authorizedRecipient[1].toLowerCase();
  const feedback = read(feedbackFile);
  const item = feedback.find(entry => entry.id === Number(req.params.id));
  const allowedStatuses = ['New', 'Under Review', 'Action Planned', 'Resolved'];

  if (!item || item.recipientEmail.toLowerCase() !== recipientEmail) {
    return res.status(404).render('not-found', {
      title: 'Feedback Not Found',
      message: 'This feedback does not belong to your inbox.'
    });
  }

  if (allowedStatuses.includes(req.body.status)) {
    item.status = req.body.status;
    item.updatedAt = new Date().toISOString();
    save(feedbackFile, feedback);
  }

  res.redirect('/feedback/inbox');
});

router.get('/register', (req, res) => {
  res.render('register', {
    title: 'Sign Up | FixIt Campus',
    error: null,
    formData: {
      name: '',
      email: '',
      role: 'student'
    }
  });
});

router.post('/register', async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const role = (req.body.role || '').trim().toLowerCase();
  const password = req.body.password || '';
  const confirmPassword = req.body.confirmPassword || '';
  const formData = { name, email, role };

  const showError = message => res.status(400).render('register', {
    title: 'Sign Up | FixIt Campus',
    error: message,
    formData
  });

  if (!name || !email || !role || !password || !confirmPassword) {
    return showError('Please complete every field.');
  }

  if (!roles.includes(role)) {
    return showError('Please select a valid account type.');
  }

  if (!validCollegeEmail(email, role)) {
    const example = role === 'student'
      ? '07240073.sherubtse@rub.edu.bt'
      : 'name.sherubtse@rub.edu.bt';

    return showError(`Use your official Sherubtse College email. Example: ${example}`);
  }

  if (password.length < 8) {
    return showError('Your password must contain at least 8 characters.');
  }

  if (password !== confirmPassword) {
    return showError('The passwords do not match.');
  }

  const users = read(usersFile);

  if (users.some(user => user.email.toLowerCase() === email)) {
    return showError('An account with this college email already exists. Please sign in.');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const newUser = {
    id: users.length ? Math.max(...users.map(user => Number(user.id))) + 1 : 1,
    name,
    email,
    password: hashedPassword,
    role,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  save(usersFile, users);

  req.session.user = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role
  };

  res.redirect(dashboardFor(role, newUser.email));
});

router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Sign In | FixIt Campus',
    error: null,
    email: ''
  });
});

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const users = read(usersFile);
  const user = users.find(item => item.email.toLowerCase() === email);

  if (!user || !validCollegeEmail(email, user.role)) {
    return res.status(401).render('login', {
      title: 'Sign In | FixIt Campus',
      error: 'Use the college email associated with your account and check your password.',
      email
    });
  }

  let passwordMatches = false;

  if (user.password.startsWith('$2')) {
    passwordMatches = await bcrypt.compare(password, user.password);
  } else {
    passwordMatches = user.password === password;
  }

  if (!passwordMatches) {
    return res.status(401).render('login', {
      title: 'Sign In | FixIt Campus',
      error: 'Email or password is incorrect.',
      email
    });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.redirect(dashboardFor(user.role, user.email));
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

function renderStudentDashboard(req, res, extra = {}, status = 200) {
  const issues = read(issuesFile)
    .filter(issue => issue.reporterEmail === req.session.user.email)
    .sort((a, b) => b.id - a.id);

  res.status(status).render('student-dashboard', Object.assign({
    title: 'Student Dashboard | FixIt Campus',
    issues,
    myComplaints: myComplaints(req.session.user.email),
    feedbackRecipients: Object.keys(feedbackRecipients),
    feedbackForm: null,
    feedbackError: null,
    feedbackSent: req.query.feedbackSent || null,
    stats: {
      total: issues.length,
      open: issues.filter(issue => issue.status !== 'Resolved').length,
      resolved: issues.filter(issue => issue.status === 'Resolved').length
    }
  }, extra));
}

router.get('/student/dashboard', signedIn, allowRoles('student'), (req, res) => {
  renderStudentDashboard(req, res);
});

router.get('/faculty/dashboard', signedIn, allowRoles('faculty'), (req, res) => {
  const issues = read(issuesFile).sort((a, b) => b.id - a.id);

  res.render('faculty-dashboard', {
    title: 'Faculty Dashboard | FixIt Campus',
    issues,
    myComplaints: myComplaints(req.session.user.email),
    stats: {
      total: issues.length,
      open: issues.filter(issue => issue.status !== 'Resolved').length,
      progress: issues.filter(issue => issue.status === 'In Progress').length,
      resolved: issues.filter(issue => issue.status === 'Resolved').length
    }
  });
});

router.get('/staff', signedIn, allowRoles('president', 'fina presedent', 'dean of accademic affair', 'dean of student affair', 'it department', 'supporting staff', 'non supporting staff'), (req, res) => {
  res.render('staff', {
    title: 'Staff Dashboard | FixIt Campus',
    issues: read(issuesFile)
  });
});

router.post('/issues/:id/status', signedIn, allowRoles('president', 'fina presedent', 'dean of accademic affair', 'dean of student affair', 'it department', 'supporting staff', 'non supporting staff'), (req, res) => {
  const issues = read(issuesFile);
  const issue = issues.find(item => item.id === Number(req.params.id));
  const allowedStatuses = ['Submitted', 'In Progress', 'Resolved'];

  if (issue && allowedStatuses.includes(req.body.status)) {
    issue.status = req.body.status;

    if (req.body.assignedTo && req.body.assignedTo.trim()) {
      issue.assignedTo = req.body.assignedTo.trim();
    }

    save(issuesFile, issues);
  }

  res.redirect('/staff');
});

// Private dashboards: DAA, IT Department and DSA.
// Each dashboard lists only the complaints addressed to that office.
const officeStatuses = ['New', 'Under Review', 'Action Planned', 'Resolved'];

function officeOnly(office) {
  return (req, res, next) => {
    if (offices.forUser(req.session.user) !== office) {
      return res.status(403).render('not-found', {
        title: 'Access Denied',
        message: `The ${office.label} is restricted to the ${office.recipient} account.`
      });
    }

    next();
  };
}

offices.forEach(office => {
  router.get(office.path, signedIn, officeOnly(office), (req, res) => {
    const mine = read(feedbackFile).filter(item => item.recipient === office.recipient || String(item.recipientEmail).toLowerCase() === office.email);
    const query = (req.query.q || '').trim().toLowerCase();
    const status = (req.query.status || '').trim();
    const feedback = mine
      .filter(item => !status || item.status === status)
      .filter(item => !query || [item.title, item.description, item.category, item.senderName, item.senderEmail]
        .some(value => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render(office.view, {
      title: `${office.label} | FixIt Campus`,
      office,
      feedback,
      query: req.query,
      statuses: officeStatuses,
      counts: {
        total: mine.length,
        new: mine.filter(item => item.status === 'New').length,
        review: mine.filter(item => item.status === 'Under Review').length,
        planned: mine.filter(item => item.status === 'Action Planned').length,
        resolved: mine.filter(item => item.status === 'Resolved').length
      }
    });
  });

  router.post(`${office.path}/feedback/:id/respond`, signedIn, officeOnly(office), (req, res) => {
    const feedback = read(feedbackFile);
    const item = feedback.find(entry => entry.id === Number(req.params.id));
    const message = (req.body.response || '').trim().slice(0, 2000);

    if (item && message && (item.recipient === office.recipient || String(item.recipientEmail).toLowerCase() === office.email)) {
      item.responses = item.responses || [];
      item.responses.push({
        message,
        office: office.recipient,
        responderName: req.session.user.name,
        responderEmail: req.session.user.email,
        createdAt: new Date().toISOString()
      });
      item.updatedAt = new Date().toISOString();
      save(feedbackFile, feedback);
    }

    res.redirect(`${office.path}#complaint-${req.params.id}`);
  });

  router.post(`${office.path}/feedback/:id/status`, signedIn, officeOnly(office), (req, res) => {
    const feedback = read(feedbackFile);
    const item = feedback.find(entry => entry.id === Number(req.params.id));

    if (item && (item.recipient === office.recipient || String(item.recipientEmail).toLowerCase() === office.email) && officeStatuses.includes(req.body.status)) {
      item.status = req.body.status;
      item.updatedAt = new Date().toISOString();
      save(feedbackFile, feedback);
    }

    res.redirect(office.path);
  });
});

router.get('/about', (req, res) => {
  res.render('about', { title: 'About | FixIt Campus' });
});

module.exports = router;
