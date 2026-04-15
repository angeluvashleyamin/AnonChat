const SUPABASE_URL = "https://cokyzugubrjdciexeysj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3l6dWd1YnJqZGNpZXhleXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzc5MzUsImV4cCI6MjA5MTgxMzkzNX0.d4RUH7eA-lEwBhAzrNajZCuvxesH0FYscthPSxaKChw";



const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const sendBtn = document.getElementById("send-btn");
const msgCounter = document.getElementById("msg-counter");
const limitNotice = document.getElementById("limit-notice");

let userMessageCount = 0;
const MESSAGE_LIMIT = 100;

const renderedMessageIds = new Set();
let channel;

// -------------------- UI --------------------

function formatTime(isoString) {
    if (!isoString) return "";

    return new Date(isoString).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function updateCounter() {
    msgCounter.textContent = `${userMessageCount} / ${MESSAGE_LIMIT} messages`;

    msgCounter.className =
        userMessageCount >= MESSAGE_LIMIT
            ? "full"
            : userMessageCount >= 80
            ? "warn"
            : "";

    if (userMessageCount >= MESSAGE_LIMIT) {
        input.disabled = true;
        sendBtn.disabled = true;
        limitNotice.style.display = "block";
    }
}

function addMessage(data) {
    if (data.id && renderedMessageIds.has(data.id)) return;
    if (data.id) renderedMessageIds.add(data.id);

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");

    msgDiv.id = data.id;

    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar");
    avatar.textContent = (data.socket_id || "AN").slice(0, 2).toUpperCase();

    const body = document.createElement("div");
    body.classList.add("message-body");

    const meta = document.createElement("div");
    meta.classList.add("message-meta");

    const idLabel = document.createElement("span");
    idLabel.classList.add("message-id");
    idLabel.textContent = data.socket_id || "anon";

    const timeLabel = document.createElement("span");
    timeLabel.classList.add("message-time");

    // ✅ ONLY USE YOUR REAL COLUMN
    timeLabel.textContent = formatTime(data.timestamp);

    const text = document.createElement("div");
    text.classList.add("message-text");
    text.textContent = data.text;

    meta.appendChild(idLabel);
    meta.appendChild(timeLabel);
    body.appendChild(meta);
    body.appendChild(text);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(body);

    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;
}

// -------------------- LOAD --------------------

async function loadMessages() {
    const { data, error } = await supabaseClient
        .from("messages")
        .select("*")
        .order("timestamp", { ascending: true }) // ✅ FIXED
        .limit(1000);

    if (error) {
        console.error("Failed to load messages:", error);
        return;
    }

    messages.innerHTML = "";
    renderedMessageIds.clear();

    data.forEach(addMessage);
}

// -------------------- REALTIME --------------------

function subscribeToMessages() {
    if (channel) {
        supabaseClient.removeChannel(channel);
    }

    channel = supabaseClient
        .channel("messages-room") // stable channel

        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages",
            },
            (payload) => {
                const msg = payload.new;

                if (renderedMessageIds.has(msg.id)) return;

                addMessage(msg);
            }
        )

        .subscribe((status) => {
            console.log("📡 realtime status:", status);
        });
}

// -------------------- USERNAME --------------------

function getRandomName() {
    const adjectives = ["Cool", "Fast", "Silent", "Lucky", "Bright", "Wild", "Dark", "Happy"];
    const animals = ["Fox", "Tiger", "Panda", "Eagle", "Wolf", "Cat", "Dragon", "Shark"];

    return (
        adjectives[Math.floor(Math.random() * adjectives.length)] +
        animals[Math.floor(Math.random() * animals.length)] +
        Math.floor(Math.random() * 1000)
    );
}

let username = localStorage.getItem("username");

if (!username) {
    username = getRandomName();
    localStorage.setItem("username", username);
}

// -------------------- SEND MESSAGE --------------------

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!input.value || userMessageCount >= MESSAGE_LIMIT) return;

    const text = input.value;
    input.value = "";

    const { error } = await supabaseClient
        .from("messages")
        .insert({
            socket_id: username,
            text: text
            // timestamp is auto-generated by DB 👍
        });

    if (!error) {
        userMessageCount++;
        updateCounter();
    } else {
        console.error("Insert failed:", error);
    }
});

// -------------------- INIT --------------------

async function init() {
    await loadMessages();
    subscribeToMessages();
}

init();