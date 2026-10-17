// Add your Supabase project URL and anon key to enable cloud sync.
const SUPABASE_URL = "https://ecwmhvslczublwnrbjas.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_f8pgwM7-KFcpBwnud0hX5g_knOYVAJh";

const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const emptyMessage = document.querySelector("#empty-message");
const taskCount = document.querySelector("#task-count");
const storageStatus = document.querySelector("#storage-status");
const clearButton = document.querySelector("#clear-button");
const filterButtons = document.querySelectorAll(".filter-button");

let tasks = [];
let currentFilter = "all";
let supabaseClient;

document.querySelector("#today-label").textContent = new Date().toLocaleDateString(
  "en",
  {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
);

function setStatus(message, isError) {
  storageStatus.textContent = message;
  storageStatus.classList.toggle("is-error", Boolean(isError));
}

function showTasks() {
  let visibleTasks = tasks;

  if (currentFilter === "active") {
    visibleTasks = tasks.filter((task) => !task.is_complete);
  } else if (currentFilter === "completed") {
    visibleTasks = tasks.filter((task) => task.is_complete);
  }

  taskList.replaceChildren();

  visibleTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-item";

    if (task.is_complete) {
      item.classList.add("is-complete");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.is_complete;
    checkbox.setAttribute(
      "aria-label",
      `Mark ${task.title} ${task.is_complete ? "active" : "complete"}`,
    );
    checkbox.addEventListener("change", () => toggleTask(task));

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.title = "Remove task";
    removeButton.setAttribute("aria-label", `Remove ${task.title}`);
    removeButton.addEventListener("click", () => removeTask(task));

    item.append(checkbox, title, removeButton);
    taskList.append(item);
  });

  const remainingTasks = tasks.filter((task) => !task.is_complete).length;
  const taskWord = remainingTasks === 1 ? "task" : "tasks";
  taskCount.textContent = `${remainingTasks} ${taskWord} left`;

  clearButton.disabled = tasks.length === 0;
  emptyState.hidden = visibleTasks.length > 0;

  if (tasks.length > 0 && visibleTasks.length === 0) {
    emptyMessage.textContent = "No tasks in this view.";
  } else {
    emptyMessage.textContent =
      "Nothing on your list yet. Add a task to get started.";
  }
}

async function loadTasks() {
  if (
    !SUPABASE_URL.startsWith("https://") ||
    SUPABASE_URL.includes("YOUR_") ||
    SUPABASE_ANON_KEY.length < 20 ||
    SUPABASE_ANON_KEY.includes("YOUR_")
  ) {
    setStatus("Supabase configuration is missing", true);
    console.error("Could not load tasks: Supabase configuration is missing.");
    return;
  }

  if (!window.supabase) {
    setStatus("Supabase library unavailable", true);
    console.error("Could not load tasks: Supabase library is unavailable.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );

  const { data, error } = await supabaseClient
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus("Supabase connection failed", true);
    console.error("Could not load tasks:", error.message);
    return;
  }

  tasks = data;
  setStatus("Synced with Supabase");
  showTasks();
}

async function addTask(title) {
  const { data, error } = await supabaseClient
    .from("todos")
    .insert({ title: title, is_complete: false })
    .select()
    .single();

  if (error) {
    throw error;
  }

  tasks.unshift(data);
  showTasks();
}

async function toggleTask(task) {
  const isComplete = !task.is_complete;
  const { error } = await supabaseClient
    .from("todos")
    .update({ is_complete: isComplete })
    .eq("id", task.id);

  if (error) {
    setStatus("Could not update task", true);
    console.error("Could not update task:", error.message);
    return;
  }

  task.is_complete = isComplete;
  showTasks();
}

async function removeTask(task) {
  const { error } = await supabaseClient
    .from("todos")
    .delete()
    .eq("id", task.id);

  if (error) {
    setStatus("Could not remove task", true);
    console.error("Could not remove task:", error.message);
    return;
  }

  tasks = tasks.filter((savedTask) => savedTask.id !== task.id);
  showTasks();
}

async function clearTasks() {
  if (tasks.length === 0) {
    return;
  }

  const shouldClear = window.confirm(
    "Remove every task? This cannot be undone.",
  );

  if (!shouldClear) {
    return;
  }

  const { error } = await supabaseClient
    .from("todos")
    .delete()
    .not("id", "is", null);

  if (error) {
    setStatus("Could not clear tasks", true);
    console.error("Could not clear tasks:", error.message);
    return;
  }

  tasks = [];
  showTasks();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = input.value.trim();

  if (title === "") {
    setStatus("Please enter a task", true);
    input.focus();
    return;
  }

  try {
    await addTask(title);
    input.value = "";
    input.focus();
    setStatus("Synced with Supabase");
  } catch (error) {
    setStatus("Could not add task", true);
    console.error("Could not add task:", error.message);
  }
});

clearButton.addEventListener("click", clearTasks);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    filterButtons.forEach((filterButton) => {
      const isSelected = filterButton === button;
      filterButton.classList.toggle("is-selected", isSelected);
      filterButton.setAttribute("aria-pressed", String(isSelected));
    });

    showTasks();
  });
});

loadTasks();
