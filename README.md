# Student Smart Planner SaaS — StudyFlow

A modern, responsive student planner dashboard built with **HTML, CSS, and vanilla JavaScript**. It runs entirely in the browser and stores planner data in `localStorage`.

## Features

- **Dashboard:** task statistics, daily focus list, upcoming exams, and a weekly activity chart.
- **Task management:** add, edit, complete, search, filter, and delete tasks.
- **Task details:** subject, due date, priority, category, and notes.
- **Exam planner:** add, edit, and delete exams with date, time, location, and preparation notes.
- **Progress tracking:** completion percentage, pending tasks, scheduled exams, and a simple activity streak.
- **Browser storage:** tasks, exams, activity, and theme preference are saved locally.
- **Export and reset:** download a JSON backup or clear local planner data.
- **Responsive UI:** desktop sidebar and mobile navigation; light/dark themes.

## Run locally

1. Download and unzip the project.
2. Open `index.html` in a modern browser.
3. Start adding tasks and exams.

No package installation or build step is required. You can also use VS Code's **Live Server** extension if you prefer a local development server.

## Publish on GitHub Pages

1. Create a repository named `student-smart-planner-saas`.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md` to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/(root)`, then save.
6. After GitHub Pages finishes deploying, open the URL shown in the Pages section.

## Project structure

```text
student-smart-planner-saas/
├── index.html
├── style.css
├── app.js
└── README.md
```

## Notes

- Data is stored in the current browser on the current device. It does not automatically sync across devices or users.
- Clearing browser site data can remove saved planner data. Use **Progress → Export my data** to make a backup.
- This is a front-end SaaS-style student project, not a multi-user service with server-side authentication or cloud synchronization.

## License

You may use and modify this project for learning and portfolio purposes.
