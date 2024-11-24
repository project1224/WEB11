const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware để phân tích dữ liệu từ form
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware để quản lý session
app.use(session({
    secret: 'your_secret_key', // Thay bằng khóa bí mật của bạn
    resave: false,
    saveUninitialized: true
}));

// Tài khoản mẫu (có thể kết nối với cơ sở dữ liệu trong tương lai)
const USERS = {
    admin: 'password123', // username: password
    giau: 'giau1'
};

// Trang đăng nhập
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// Xử lý đăng nhập
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (USERS[username] && USERS[username] === password) {
        req.session.user = username; // Lưu thông tin vào session
        return res.redirect('/'); // Chuyển hướng đến trang chính
    }
    res.send('Đăng nhập thất bại! <a href="/login">Thử lại</a>');
});

// Middleware kiểm tra đăng nhập
app.use((req, res, next) => {
    if (req.session.user || req.path === '/login') {
        next(); // Tiếp tục nếu đã đăng nhập
    } else {
        res.redirect('/login'); // Chuyển hướng đến trang đăng nhập
    }
});

// Phục vụ file tĩnh
app.use(express.static('public'));

// MQTT Broker
// Thông tin kết nối tới HiveMQ Cloud
const mqttUrl = 'mqtts://fd873da0fa7248d3b85f7580f8543f7a.s1.eu.hivemq.cloud'; // URL broker HiveMQ
const mqttOptions = {
    username: 'Kettran', // Tên người dùng
    password: 'Kettran123@' // Mật khẩu
};

// Kết nối đến MQTT broker của HiveMQ
const client = mqtt.connect(mqttUrl, mqttOptions);

// Kết nối thành công
client.on('connect', () => {
    console.log('Connected to HiveMQ Cloud Broker');
    client.subscribe('Setpoints/SATemp', (err) => {
        if (err) {
            console.log('Subscription failed:', err);
        } else {
            console.log('Subscribed to topic: Setpoints/SATemp');
        }
    });
});

// Nhận tin nhắn từ broker và gửi đến WebSocket clients
client.on('message', (topic, message) => {
    console.log(`Received message from MQTT Broker: ${message.toString()}`);
    
    // Gửi tin nhắn đến tất cả các WebSocket clients
    wss.clients.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(`Topic: ${topic}, Message: ${message.toString()}`);
        }
    });
});

// WebSocket xử lý kết nối
wss.on('connection', (socket) => {
    console.log('Web client connected via WebSocket');
    
    // Lắng nghe tin nhắn từ WebSocket client và gửi đến MQTT broker
    socket.on('message', (message) => {
        console.log(`Message from web: ${message}`);
        client.publish('test/topic', message); // Gửi đến MQTT broker
    });

    // Đăng ký nhận các tin nhắn từ MQTT broker và gửi chúng đến WebSocket client
    client.subscribe('Setpoints/SATemp', (err) => {
        if (err) {
            console.log('Failed to subscribe to topic Setpoints/SATemp');
        }
    });
});

// Bắt đầu server
server.listen(8080, () => {
    console.log('WebSocket and HTTP server are running on port 8080');
});
