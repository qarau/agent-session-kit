import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function getArgValue(argv, name, fallback) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        return fallback;
      }
      return next;
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return fallback;
}

function getToday() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function findSectionRange(lines, headingName) {
  const heading = `## ${headingName}`;
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) {
    return {
      start: -1,
      end: -1,
    };
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      end = index;
      break;
    }
  }

  return {
    start,
    end,
  };
}

function parseTasksFromRange(lines, range) {
  if (range.start < 0) {
    return [];
  }

  const tasks = [];
  for (let index = range.start + 1; index < range.end; index += 1) {
    const line = lines[index];
    const match = line.match(/^- \[( |x|X)\] (.+)$/);
    if (!match) {
      continue;
    }
    tasks.push({
      completed: match[1].toLowerCase() === 'x',
      text: match[2].trim(),
    });
  }
  return tasks;
}

function formatTask(task) {
  return `- [${task.completed ? 'x' : ' '}] ${task.text}`;
}

function getOpenTaskTexts(tasks) {
  return tasks.filter((task) => !task.completed).map((task) => task.text);
}

function resolveRecommendation(nowTasks, nextTasks) {
  const openNow = getOpenTaskTexts(nowTasks);
  const openNext = getOpenTaskTexts(nextTasks);

  if (openNow.length > 0) {
    return {
      recommended: openNow[0],
      queue: [...openNow.slice(1), ...openNext].slice(0, 3),
    };
  }

  if (openNext.length > 0) {
    return {
      recommended: openNext[0],
      queue: openNext.slice(1, 4),
    };
  }

  return {
    recommended: null,
    queue: [],
  };
}

function printRecommendation(recommendation) {
  if (!recommendation.recommended) {
    console.log('Recommended next task: none (all tasks complete)');
    return;
  }

  console.log(`Recommended next task: ${recommendation.recommended}`);
  if (recommendation.queue.length > 0) {
    console.log('Queue:');
    recommendation.queue.forEach((task, index) => {
      console.log(`${index + 1}. ${task}`);
    });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const tasksPath = path.resolve(process.cwd(), getArgValue(argv, '--tasks', 'docs/session/tasks.md'));
  const explicitTask = getArgValue(argv, '--task', '').trim();

  if (!fs.existsSync(tasksPath)) {
    console.warn(`[complete-task] tasks file not found: ${tasksPath}`);
    process.exit(0);
  }

  const raw = fs.readFileSync(tasksPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const today = getToday();

  const nowRange = findSectionRange(lines, 'Now');
  const nextRange = findSectionRange(lines, 'Next');
  const doneRange = findSectionRange(lines, 'Done');

  const nowTasks = parseTasksFromRange(lines, nowRange);
  const nextTasks = parseTasksFromRange(lines, nextRange);
  const doneTasks = parseTasksFromRange(lines, doneRange);

  let completedTaskText = '';
  const fromNowIndex = explicitTask
    ? nowTasks.findIndex((task) => !task.completed && task.text === explicitTask)
    : nowTasks.findIndex((task) => !task.completed);
  if (fromNowIndex >= 0) {
    completedTaskText = nowTasks[fromNowIndex].text;
    nowTasks.splice(fromNowIndex, 1);
  } else {
    const fromNextIndex = explicitTask
      ? nextTasks.findIndex((task) => !task.completed && task.text === explicitTask)
      : -1;
    if (fromNextIndex >= 0) {
      completedTaskText = nextTasks[fromNextIndex].text;
      nextTasks.splice(fromNextIndex, 1);
    }
  }

  if (!completedTaskText) {
    console.log('No incomplete task available to complete.');
    printRecommendation(resolveRecommendation(nowTasks, nextTasks));
    process.exit(0);
  }

  doneTasks.push({
    completed: true,
    text: `${today} - ${completedTaskText}`,
  });

  const nowHasOpenTask = nowTasks.some((task) => !task.completed);
  if (!nowHasOpenTask) {
    const nextOpenIndex = nextTasks.findIndex((task) => !task.completed);
    if (nextOpenIndex >= 0) {
      const [promoted] = nextTasks.splice(nextOpenIndex, 1);
      nowTasks.push({
        completed: false,
        text: promoted.text,
      });
    }
  }

  const updatedLines = lines.map((line) => (line.startsWith('Last updated:') ? `Last updated: ${today}` : line));
  const updatedNowRange = findSectionRange(updatedLines, 'Now');
  const updatedDoneRange = findSectionRange(updatedLines, 'Done');
  const prefix = updatedNowRange.start >= 0 ? updatedLines.slice(0, updatedNowRange.start) : updatedLines;
  const suffix = updatedDoneRange.end >= 0 ? updatedLines.slice(updatedDoneRange.end) : [];

  const nextContent = [
    ...prefix,
    '## Now',
    '',
    ...(nowTasks.length > 0 ? nowTasks.map(formatTask) : ['- [ ] <single in-progress task>']),
    '',
    '## Next',
    '',
    ...(nextTasks.length > 0 ? nextTasks.map(formatTask) : ['- [ ] <next task>']),
    '',
    '## Done',
    '',
    ...(doneTasks.length > 0 ? doneTasks.map(formatTask) : ['- [x] YYYY-MM-DD - <completed task summary>']),
    ...suffix,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  fs.writeFileSync(tasksPath, `${nextContent}\n`);

  console.log(`Completed task: ${completedTaskText}`);
  printRecommendation(resolveRecommendation(nowTasks, nextTasks));
}

main();
