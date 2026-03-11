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

function parseTasks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = new Map();
  let currentSection = '';

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      currentSection = heading[1].trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    const task = line.match(/^- \[( |x|X)\] (.+)$/);
    if (task && currentSection) {
      const entries = sections.get(currentSection) ?? [];
      entries.push({
        completed: task[1].toLowerCase() === 'x',
        text: task[2].trim(),
      });
      sections.set(currentSection, entries);
    }
  }

  return {
    now: (sections.get('Now') ?? []).filter((task) => !task.completed).map((task) => task.text),
    next: (sections.get('Next') ?? []).filter((task) => !task.completed).map((task) => task.text),
  };
}

function resolveRecommendation(taskData) {
  if (taskData.now.length > 0) {
    return {
      recommended: taskData.now[0],
      queue: [...taskData.now.slice(1), ...taskData.next].slice(0, 3),
    };
  }

  if (taskData.next.length > 0) {
    return {
      recommended: taskData.next[0],
      queue: taskData.next.slice(1, 4),
    };
  }

  return {
    recommended: null,
    queue: [],
  };
}

function printReminder(recommendation) {
  console.log('ASK Next Task Reminder');
  if (!recommendation.recommended) {
    console.log('Recommended next task: none (all tasks complete)');
    return;
  }

  console.log(`Recommended next task: ${recommendation.recommended}`);
  if (recommendation.queue.length === 0) {
    return;
  }

  console.log('Queue:');
  recommendation.queue.forEach((task, index) => {
    console.log(`${index + 1}. ${task}`);
  });
}

function main() {
  const argv = process.argv.slice(2);
  const tasksPath = path.resolve(process.cwd(), getArgValue(argv, '--tasks', 'docs/session/tasks.md'));

  if (!fs.existsSync(tasksPath)) {
    console.warn(`[next-task] tasks file not found: ${tasksPath}`);
    process.exit(0);
  }

  const taskData = parseTasks(fs.readFileSync(tasksPath, 'utf8'));
  printReminder(resolveRecommendation(taskData));
}

main();
