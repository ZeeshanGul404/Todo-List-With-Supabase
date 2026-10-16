// Add your Supabase project URL and anon key to enable cloud sync.
const SUPABASE_URL = "https://ecwmhvslczublwnrbjas.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_f8pgwM7-KFcpBwnud0hX5g_knOYVAJh";
const STORAGE_KEY = "daymark-tasks";

const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const list = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const emptyMessage = document.querySelector("#empty-message");
const countLabel = document.querySelector("#task-count");
const statusLabel = document.querySelector("#storage-status");
const clearButton = document.querySelector("#clear-button");
const filterButtons = document.querySelectorAll(".filter-button");

let tasks = [];
let activeFilter = "all";
let supabaseClient = null;

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(
  "en",
  {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
).format(new Date());

function hasSupabaseConfig() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_")
  );
}

function setStatus(message, isError = false) {
  statusLabel.textContent = message;
  statusLabel.classList.toggle("is-error", isError);
}

function saveLocalTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

async function loadTasks() {
  if (hasSupabaseConfig() && window.supabase) {
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
  } else {
    try {
      tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      tasks = [];
    }
    setStatus("Saved on this device");
  }
  renderTasks();
}

function renderTasks() {
  const visibleTasks = tasks.filter((task) => {
    if (activeFilter === "active") return !task.is_complete;
    if (activeFilter === "completed") return task.is_complete;
    return true;
  });

  list.replaceChildren();
  for (const task of visibleTasks) {
    const item = document.createElement("li");
    item.className = `task-item${task.is_complete ? " is-complete" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.className = "task-checkbox";
    checkbox.type = "checkbox";
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
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.title = "Remove task";
    removeButton.setAttribute("aria-label", `Remove ${task.title}`);
    removeButton.addEventListener("click", () => removeTask(task));

    item.append(checkbox, title, removeButton);
    list.append(item);
  }

  const remaining = tasks.filter((task) => !task.is_complete).length;
  countLabel.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
  clearButton.disabled = tasks.length === 0;
  emptyState.hidden = visibleTasks.length > 0;
  if (tasks.length > 0 && visibleTasks.length === 0) {
    emptyMessage.textContent = "No tasks in this view.";
  } else {
    emptyMessage.textContent =
      "Nothing on your list yet. Add a task to get started.";
  }
}

async function addTask(title) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("todos")
      .insert({ title, is_complete: false })
      .select()
      .single();
    if (error) throw error;
    tasks.unshift(data);
  } else {
    tasks.unshift({ id: crypto.randomUUID(), title, is_complete: false });
    saveLocalTasks();
  }
  renderTasks();
}

async function toggleTask(task) {
  const isComplete = !task.is_complete;
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("todos")
      .update({ is_complete: isComplete })
      .eq("id", task.id);
    if (error) {
      setStatus("Could not update task", true);
      return;
    }
  }
  task.is_complete = isComplete;
  if (!supabaseClient) saveLocalTasks();
  renderTasks();
}

async function removeTask(task) {
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("todos")
      .delete()
      .eq("id", task.id);
    if (error) {
      setStatus("Could not remove task", true);
      return;
    }
  }
  tasks = tasks.filter((item) => item.id !== task.id);
  if (!supabaseClient) saveLocalTasks();
  renderTasks();
}

async function clearTasks() {
  if (
    tasks.length === 0 ||
    !window.confirm("Remove every task? This cannot be undone.")
  )
    return;
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("todos")
      .delete()
      .not("id", "is", null);
    if (error) {
      setStatus("Could not clear tasks", true);
      return;
    }
  }
  tasks = [];
  if (!supabaseClient) saveLocalTasks();
  renderTasks();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  try {
    await addTask(title);
    input.value = "";
    input.focus();
    if (supabaseClient) setStatus("Synced with Supabase");
  } catch (error) {
    setStatus("Could not add task", true);
    console.error("Could not add task:", error.message);
  }
});

clearButton.addEventListener("click", clearTasks);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const selected = filterButton === button;
      filterButton.classList.toggle("is-selected", selected);
      filterButton.setAttribute("aria-pressed", String(selected));
    });
    renderTasks();
  });
});

loadTasks();
