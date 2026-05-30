import mongoose from "mongoose";
import express from "express";
import cors from "cors";

let app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("mongoDb connected"))
    .catch(err => console.log(err));

let table = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    sent: [{ to: String, mgs: String, time: Date }],
    receive: [{ from: String, mgs: String, time: Date }]
});

let coll = mongoose.model("mgs", table);

// ─────────────────────────────────────────────
// ONLINE PRESENCE — in-memory map (no DB needed)
// ─────────────────────────────────────────────
const onlineMap = new Map(); // userId -> lastSeen timestamp
const ONLINE_THRESHOLD_MS = 45000; // 45 seconds

// POST /mgs/online — heartbeat (called every 30s from frontend)
app.post("/mgs/online", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    onlineMap.set(userId, Date.now());
    res.json({ success: true });
});

// POST /mgs/offline — called on signout or tab close
app.post("/mgs/offline", (req, res) => {
    const { userId } = req.body;
    if (userId) onlineMap.delete(userId);
    res.json({ success: true });
});

// GET /mgs/online — returns array of currently online userIds
app.get("/mgs/online", (req, res) => {
    const now = Date.now();
    const onlineIds = [];
    for (const [userId, lastSeen] of onlineMap.entries()) {
        if (now - lastSeen <= ONLINE_THRESHOLD_MS) {
            onlineIds.push(userId);
        } else {
            onlineMap.delete(userId); // auto-cleanup stale entries
        }
    }
    res.json(onlineIds);
});

// ─────────────────────────────────────────────
// CONVERSATION — must be BEFORE /:id
// ─────────────────────────────────────────────
app.get("/mgs/conversation/:myId/:otherId", async (req, res) => {
    try {
        const me = await coll.findById(req.params.myId);
        const other = await coll.findById(req.params.otherId);
        const sent = me.sent
            .filter(m => m.to === other.email)
            .map(m => ({ type: "sent", mgs: m.mgs, time: m.time }));
        const received = me.receive
            .filter(m => m.from === other.email)
            .map(m => ({ type: "received", mgs: m.mgs, time: m.time }));
        const conversation = [...sent, ...received].sort((a, b) => new Date(a.time) - new Date(b.time));
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
app.get("/mgs", async (req, res) => {
    let one = await coll.find();
    res.json(one);
});

app.get("/mgs/:id", async (req, res) => {
    let one = await coll.findById(req.params.id);
    res.json(one);
});

app.post("/mgs", async (req, res) => {
    let data = new coll(req.body);
    await data.save();
});

app.delete("/mgs/:id", async (req, res) => {
    await coll.findByIdAndDelete(req.params.id);
});

app.put("/mgs/:id", async (req, res) => {
    await coll.findByIdAndUpdate(req.params.id);
});

app.put("/mgs", async (req, res) => {
    try {
        let sender = await coll.findById(req.body.senderId);
        let receiver = await coll.findById(req.body.receiverId);
        sender.sent.push({
            to: req.body.receiverEmail,
            mgs: req.body.message,
            time: new Date()
        });
        receiver.receive.push({
            from: req.body.senderEmail,
            mgs: req.body.message,
            time: new Date()
        });
        await sender.save();
        await receiver.save();
        res.json({ success: true, msg: "message sent" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false });
    }
});

let PORT = process.env.PORT || 7780;
app.listen(PORT, () => {
    console.log("Server is Running");
});
