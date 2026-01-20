// Lap Video Online - полный скрипт
// Оптимизирован для телефонов и ПК

// Основные переменные
let localStream = null;
let remoteStream = null;
let peer = null;
let currentPeerId = null;
let roomId = null;
let screenStream = null;
let isCameraOn = true;
let isMicOn = true;
let isScreenSharing = false;
let isCameraFlipped = false;
let currentCall = null;

// DOM элементы
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleCameraBtn = document.getElementById('toggleCamera');
const toggleMicBtn = document.getElementById('toggleMic');
const shareScreenBtn = document.getElementById('shareScreen');
const rotateCameraBtn = document.getElementById('rotateCamera');
const inviteBtn = document.getElementById('inviteBtn');
const endCallBtn = document.getElementById('endCall');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const roomNumber = document.getElementById('roomNumber');
const micStatus = document.getElementById('micStatus');
const cameraStatus = document.getElementById('cameraStatus');
const localStatus = document.getElementById('localStatus');
const remoteStatus = document.getElementById('remoteStatus');
const waitingMessage = document.getElementById('waitingMessage');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const inviteModal = document.getElementById('inviteModal');
const closeModal = document.getElementById('closeModal');
const inviteLink = document.getElementById('inviteLink');
const copyInviteLink = document.getElementById('copyInviteLink');
const p2pStatus = document.getElementById('p2pStatus');

// Утилиты
function showNotification(message, type = 'success') {
    notificationText.textContent = message;
    notification.style.background = type === 'error' 
        ? 'linear-gradient(90deg, #ef4444, #f87171)'
        : type === 'warning'
        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
        : 'linear-gradient(90deg, #10b981, #34d399)';
    
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 4000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Скопировано:', text);
    }).catch(err => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

// Генерация ID комнаты
function generateRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('room');
    
    // Если в URL уже есть ID комнаты (для подключения), используем его
    if (urlRoomId) {
        return urlRoomId;
    }
    
    // Иначе генерируем новый уникальный ID для создания комнаты
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Обновление URL
function updateUrlWithRoomId(id) {
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${id}`;
    window.history.replaceState({}, document.title, newUrl);
    inviteLink.value = newUrl;
    return newUrl;
}

// Запуск камеры (адаптировано для телефонов)
async function startLocalCamera() {
    try {
        // Оптимизация для телефонов
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        const constraints = {
            video: {
                width: { ideal: isMobile ? 640 : 1280 },
                height: { ideal: isMobile ? 480 : 720 },
                frameRate: { ideal: 24 },
                facingMode: 'user'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        // Адаптация видео для телефонов
        localVideo.style.objectFit = 'cover';
        
        // Активируем кнопки
        toggleCameraBtn.disabled = false;
        toggleMicBtn.disabled = false;
        shareScreenBtn.disabled = false;
        
        localStatus.innerHTML = '<i class="fas fa-circle"></i> онлайн';
        localStatus.style.color = '#10b981';
        
        showNotification('Камера активирована');
        return true;
        
    } catch (error) {
        console.error('Ошибка камеры:', error);
        
        // Пробуем только аудио, если камера недоступна
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localVideo.style.display = 'none';
            showNotification('Камера недоступна. Работаем только с аудио', 'warning');
            return true;
        } catch (audioError) {
            showNotification('Не удалось получить доступ к камере и микрофону', 'error');
            return false;
        }
    }
}

// Инициализация Peer соединения
async function initPeerConnection() {
    try {
        // Генерируем ID комнаты
        roomId = generateRoomId();
        roomNumber.textContent = roomId;
        
        // Обновляем URL
        updateUrlWithRoomId(roomId);
        
        // Для мобильных устройств используем более стабильные настройки
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        // Инициализируем Peer с ТВОИМ сервером
        peer = new Peer(roomId, {
            host: 'peerjs-server-production-b727.up.railway.app',
            port: 443,
            path: '/peerjs',
            secure: true,
            debug: isMobile ? 0 : 1, // Меньше логов на телефоне для производительности
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });
        
        // События Peer
        peer.on('open', (id) => {
            currentPeerId = id;
            p2pStatus.textContent = 'Готово';
            p2pStatus.style.color = '#10b981';
            
            // Для мобильных: показываем уведомление о готовности
            if (isMobile) {
                showNotification('Готово к звонку!');
            }
            
            console.log('Peer ID:', id);
        });
        
        peer.on('error', (err) => {
            console.error('Peer ошибка:', err);
            
            // Автопереподключение для мобильных
            if (isMobile && err.type === 'network') {
                setTimeout(() => {
                    showNotification('Переподключение...', 'warning');
                    initPeerConnection();
                }, 3000);
            } else {
                showNotification('Ошибка соединения: ' + err.message, 'error');
            }
        });
        
        // Обработка входящих звонков
        peer.on('call', async (call) => {
            showNotification('Входящий звонок...');
            
            // Отвечаем на звонок с нашим потоком
            call.answer(localStream);
            currentCall = call;
            
            // Получаем удалённый поток
            call.on('stream', (stream) => {
                remoteStream = stream;
                remoteVideo.srcObject = stream;
                remoteStatus.innerHTML = '<i class="fas fa-circle"></i> подключен';
                remoteStatus.style.color = '#10b981';
                waitingMessage.style.display = 'none';
                showNotification('Собеседник подключился!');
            });
            
            call.on('close', () => {
                handleCallEnd();
            });
            
            call.on('error', (err) => {
                console.error('Ошибка звонка:', err);
                showNotification('Ошибка звонка', 'error');
            });
        });
        
        // Автоматическое подключение, если в URL есть ID другой комнаты
        const urlParams = new URLSearchParams(window.location.search);
        const connectToRoomId = urlParams.get('room');
        
        if (connectToRoomId && connectToRoomId !== roomId) {
            // Ждём инициализации камеры перед подключением
            setTimeout(() => {
                connectToPeer(connectToRoomId);
            }, 1000);
        }
        
        return true;
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка инициализации звонка', 'error');
        return false;
    }
}

// Подключение к другому участнику
async function connectToPeer(peerId) {
    if (!localStream) {
        await startLocalCamera();
    }
    
    if (!peer || peer.disconnected) {
        showNotification('Соединение не готово', 'error');
        return;
    }
    
    try {
        showNotification('Подключение...');
        
        const call = peer.call(peerId, localStream);
        currentCall = call;
        
        call.on('stream', (stream) => {
            remoteStream = stream;
            remoteVideo.srcObject = stream;
            remoteStatus.innerHTML = '<i class="fas fa-circle"></i> подключен';
            remoteStatus.style.color = '#10b981';
            waitingMessage.style.display = 'none';
            showNotification('Подключено!');
        });
        
        call.on('close', () => {
            handleCallEnd();
        });
        
        call.on('error', (err) => {
            console.error('Ошибка подключения:', err);
            showNotification('Не удалось подключиться', 'error');
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка подключения', 'error');
    }
}

// Обработка завершения звонка
function handleCallEnd() {
    remoteVideo.srcObject = null;
    waitingMessage.style.display = 'block';
    remoteStatus.innerHTML = '<i class="fas fa-circle"></i> отключен';
    remoteStatus.style.color = '#ef4444';
    currentCall = null;
}

// Управление камерой (оптимизировано для телефонов)
function toggleCamera() {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
        isCameraOn = !isCameraOn;
        videoTracks[0].enabled = isCameraOn;
        
        const icon = toggleCameraBtn.querySelector('i');
        const text = toggleCameraBtn.querySelector('span');
        
        if (isCameraOn) {
            icon.className = 'fas fa-video';
            text.textContent = 'Выкл. камеру';
            cameraStatus.textContent = 'вкл';
            cameraStatus.style.color = '#10b981';
            showNotification('Камера включена');
        } else {
            icon.className = 'fas fa-video-slash';
            text.textContent = 'Вкл. камеру';
            cameraStatus.textContent = 'выкл';
            cameraStatus.style.color = '#ef4444';
            showNotification('Камера выключена');
        }
    }
}

// Управление микрофоном
function toggleMicrophone() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        isMicOn = !isMicOn;
        audioTracks[0].enabled = isMicOn;
        
        const icon = toggleMicBtn.querySelector('i');
        const text = toggleMicBtn.querySelector('span');
        
        if (isMicOn) {
            icon.className = 'fas fa-microphone';
            text.textContent = 'Выкл. микрофон';
            micStatus.textContent = 'вкл';
            micStatus.style.color = '#10b981';
            showNotification('Микрофон включен');
        } else {
            icon.className = 'fas fa-microphone-slash';
            text.textContent = 'Вкл. микрофон';
            micStatus.textContent = 'выкл';
            micStatus.style.color = '#ef4444';
            showNotification('Микрофон выключен');
        }
    }
}

// Демонстрация экрана (только для десктопов)
async function toggleScreenShare() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        showNotification('Демонстрация экрана недоступна на телефоне', 'warning');
        return;
    }
    
    try {
        if (!isScreenSharing) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: true
            });
            
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Заменяем видеотрек
            const localVideoTrack = localStream.getVideoTracks()[0];
            localStream.removeTrack(localVideoTrack);
            localStream.addTrack(screenTrack);
            localVideo.srcObject = localStream;
            
            isScreenSharing = true;
            
            const icon = shareScreenBtn.querySelector('i');
            const text = shareScreenBtn.querySelector('span');
            icon.className = 'fas fa-stop-circle';
            text.textContent = 'Стоп экран';
            
            showNotification('Демонстрация экрана');
            
            // Остановка по завершению
            screenTrack.onended = () => {
                if (isScreenSharing) {
                    toggleScreenShare();
                }
            };
            
        } else {
            // Возвращаем камеру
            screenStream.getTracks().forEach(track => track.stop());
            
            const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const cameraTrack = cameraStream.getVideoTracks()[0];
            
            localStream.removeTrack(localStream.getVideoTracks()[0]);
            localStream.addTrack(cameraTrack);
            localVideo.srcObject = localStream;
            
            isScreenSharing = false;
            
            const icon = shareScreenBtn.querySelector('i');
            const text = shareScreenBtn.querySelector('span');
            icon.className = 'fas fa-desktop';
            text.textContent = 'Поделиться экраном';
            
            showNotification('Экран остановлен');
        }
    } catch (error) {
        console.error('Ошибка экрана:', error);
        showNotification('Ошибка демонстрации экрана', 'error');
    }
}

// Переворот камеры
function rotateCamera() {
    isCameraFlipped = !isCameraFlipped;
    localVideo.style.transform = isCameraFlipped ? 'scaleX(-1)' : 'scaleX(1)';
    showNotification(isCameraFlipped ? 'Камера перевёрнута' : 'Камера нормально');
}

// Завершение звонка
function endCall() {
    if (confirm('Завершить видеозвонок?')) {
        if (currentCall) {
            currentCall.close();
        }
        
        if (peer) {
            peer.destroy();
        }
        
        handleCallEnd();
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        showNotification('Звонок завершён');
        
        // Перезагрузка через 2 секунды
        setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname;
        }, 2000);
    }
}

// Копирование ссылки
function copyRoomLink() {
    const link = window.location.href;
    copyToClipboard(link);
    showNotification('Ссылка скопирована');
}

// Шаринг ссылки
function shareLink(platform) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('Присоединяйся к видеозвонку!');
    
    let shareUrl;
    
    switch(platform) {
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${text}%20${url}`;
            break;
        case 'telegram':
            shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=Видеозвонок&body=${text}%0A%0A${url}`;
            break;
        default:
            return;
    }
    
    window.open(shareUrl, '_blank');
    inviteModal.classList.remove('active');
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Основные кнопки
    toggleCameraBtn.addEventListener('click', toggleCamera);
    toggleMicBtn.addEventListener('click', toggleMicrophone);
    shareScreenBtn.addEventListener('click', toggleScreenShare);
    rotateCameraBtn.addEventListener('click', rotateCamera);
    inviteBtn.addEventListener('click', () => inviteModal.classList.add('active'));
    endCallBtn.addEventListener('click', endCall);
    copyRoomBtn.addEventListener('click', copyRoomLink);
    
    // Модальное окно
    closeModal.addEventListener('click', () => inviteModal.classList.remove('active'));
    copyInviteLink.addEventListener('click', () => {
        copyToClipboard(inviteLink.value);
        showNotification('Ссылка скопирована');
    });
    
    // Кнопки шаринга
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const platform = this.classList[1];
            shareLink(platform);
        });
    });
    
    // Клик вне модального
    window.addEventListener('click', (e) => {
        if (e.target === inviteModal) {
            inviteModal.classList.remove('active');
        }
    });
    
    // Адаптация для мобильных: тапы вместо ховеров
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.95)';
            });
            btn.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });
    }
    
    // Ориентация экрана на мобильных
    if (isMobile) {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                showNotification('Поверните экран для лучшего вида', 'warning');
            }, 1000);
        });
    }
}

// Инициализация при загрузке
async function init() {
    try {
        showNotification('Запуск Lap Video Online...');
        
        // Настройка обработчиков
        setupEventListeners();
        
        // Запуск камеры
        const cameraStarted = await startLocalCamera();
        if (!cameraStarted) return;
        
        // Инициализация Peer соединения
        await initPeerConnection();
        
        // Показать статус готовности
        setTimeout(() => {
            showNotification('Готово к звонку! Отправьте ссылку собеседнику');
        }, 1000);
        
        // Обновление статусов
        updateStatusIndicators();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка запуска приложения', 'error');
    }
}

// Обновление индикаторов статуса
function updateStatusIndicators() {
    const webrtcStatus = document.getElementById('webrtcStatus');
    const videoTechStatus = document.getElementById('videoTechStatus');
    
    if (typeof RTCPeerConnection !== 'undefined') {
        webrtcStatus.textContent = 'Активен';
        webrtcStatus.style.color = '#10b981';
        videoTechStatus.textContent = 'WebRTC';
    } else {
        webrtcStatus.textContent = 'Не поддерживается';
        webrtcStatus.style.color = '#ef4444';
        videoTechStatus.textContent = 'Недоступно';
    }
}

// Запуск при загрузке страницы
window.addEventListener('DOMContentLoaded', init);

// Предупреждение при закрытии
window.addEventListener('beforeunload', (e) => {
    if (currentCall || (peer && !peer.disconnected)) {
        e.preventDefault();
        e.returnValue = 'У вас активный видеозвонок. Закрыть страницу?';
    }
});

// Автоматическое восстановление при потере фокуса (для мобильных)
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && peer && peer.disconnected) {
        showNotification('Переподключение...', 'warning');
        setTimeout(() => initPeerConnection(), 1000);
    }
});
