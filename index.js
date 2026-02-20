const { Client, IntentsBitField, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs'); // Thêm module fs để lưu dữ liệu vào file
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

const CHANNEL_ID = '1474244598024114361'; // ID của kênh chỉ định

// Link ảnh lớn (ở dưới tin nhắn) và ảnh nhỏ (ở đầu tin nhắn)
const LARGE_IMAGE_URL = 'https://i.pinimg.com/736x/1d/1e/71/1d1e71c0d8f82c1d03ca0f314b33fdc3.jpg'; // Thay bằng link ảnh lớn của bạn
const SMALL_ICON_URL = 'https://cdn.cdnstep.com/I1HM9229VjVwYrQTDGgc/cover-1.thumb256.png'; // Thay bằng link ảnh nhỏ của bạn

// Mảng để lưu màu ngẫu nhiên cho thanh bên trái
const colors = ['#FF0000', '#00FF00', '#0000FF', '#fbfb00', '#FF00FF', '#6ac2c2'];
let colorIndex = 0;

// Lưu trữ thông tin order
let orders = new Map();

// File để lưu trữ orders
const ORDERS_FILE = 'orders.json';

// Load orders từ file khi bot khởi động
function loadOrders() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const data = fs.readFileSync(ORDERS_FILE, 'utf8');
            const parsedData = JSON.parse(data);
            // Chuyển object thành Map
            orders = new Map(Object.entries(parsedData));
            console.log('Đã tải danh sách đơn hàng từ file:', Array.from(orders.keys()));
        }
    } catch (error) {
        console.error('Lỗi khi tải orders từ file:', error);
        orders = new Map();
    }
}

// Lưu orders vào file
function saveOrders() {
    try {
        // Chuyển Map thành object để lưu vào JSON
        const ordersObject = Object.fromEntries(orders);
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersObject, null, 2));
        console.log('Đã lưu danh sách đơn hàng vào file:', Array.from(orders.keys()));
    } catch (error) {
        console.error('Lỗi khi lưu orders vào file:', error);
    }
}

// Load orders khi bot khởi động
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    loadOrders();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Lệnh !add để tạo đơn hàng
    if (message.content.startsWith('!add')) {
        const args = message.content.split(' ').slice(1);
        if (args.length < 2) {
            return message.reply('Vui lòng cung cấp ID khách hàng và mô tả! Cú pháp: !add <@iduser> <mô tả>');
        }

        // Lấy ID khách hàng từ mention
        const userMention = args[0];
        const userIdMatch = userMention.match(/^<@!?(\d+)>$/);
        if (!userIdMatch) {
            return message.reply('ID khách hàng không hợp lệ! Vui lòng mention khách hàng theo dạng @iduser.');
        }
        const userId = userIdMatch[1];
        const ticket = args.slice(1).join(' ') || 'Không có mô tả';
        const orderId = `order_${Date.now()}`;
        const createdAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }); // Thời gian tạo đơn

        // Lấy thông tin khách hàng
        let customer;
        try {
            customer = await client.users.fetch(userId);
        } catch (error) {
            return message.reply('Không tìm thấy khách hàng với ID này!');
        }

        // Tạo embed với trạng thái "Đang xử lý"
        const embed = new EmbedBuilder()
            .setTitle('DoA Store')
            .setAuthor({ name: 'DoA Store', iconURL: SMALL_ICON_URL }) // Hình nhỏ ở đầu
            .setDescription(`
                **ID Đơn:** ${orderId}  
                **Khách Hàng:** <@${userId}>  
                **Ticket:** ${ticket}  
                **Thời Gian Lên Đơn:** ${createdAt}  
                **Trạng Thái:** Đang Xử Lý
            `)
            .setColor(colors[colorIndex])
            .setThumbnail(customer.displayAvatarURL({ dynamic: true })) // Avatar khách hàng ở góc bên phải
            .setImage(LARGE_IMAGE_URL) // Hình lớn ở dưới
            .setFooter({ text: 'Verdict | CBVN | https://discord.gg/wQtBckzc' }); // Dòng bản quyền ở cuối

        // Lấy kênh chỉ định
        const targetChannel = await client.channels.fetch(CHANNEL_ID);
        if (!targetChannel) {
            return message.reply('Không tìm thấy kênh chỉ định! Vui lòng kiểm tra CHANNEL_ID.');
        }

        // Gửi tin nhắn vào kênh chỉ định và lưu trữ
        const sentMessage = await targetChannel.send({ embeds: [embed] });
        orders.set(orderId, { 
            ticket, 
            messageId: sentMessage.id, 
            channelId: sentMessage.channel.id, 
            createdAt, 
            customerId: userId, 
            customerAvatar: customer.displayAvatarURL({ dynamic: true }),
            originalEmbed: embed.toJSON() // Lưu trữ embed dưới dạng JSON
        });

        // Lưu orders vào file
        saveOrders();

        // Log để kiểm tra
        console.log(`Đã tạo đơn hàng: ${orderId}, Message ID: ${sentMessage.id}`);
        console.log('Danh sách đơn hàng hiện tại:', Array.from(orders.keys()));

        // Thông báo cho admin rằng đơn hàng đã được gửi
        await message.reply(`Đơn hàng ${orderId} đã được gửi vào kênh chỉ định! Message ID: ${sentMessage.id}`);
    }

    // Lệnh !s để cập nhật trạng thái đơn hàng
    if (message.content.startsWith('!s')) {
        const args = message.content.split(' ').slice(1);
        if (args.length < 1) {
            return message.reply('Vui lòng cung cấp ID tin nhắn! Cú pháp: !s <messageId>');
        }

        const messageId = args[0];

        // Tìm đơn hàng có messageId tương ứng
        let orderIdToUpdate = null;
        let orderToUpdate = null;
        for (const [orderId, order] of orders.entries()) {
            if (order.messageId === messageId) {
                orderIdToUpdate = orderId;
                orderToUpdate = order;
                break;
            }
        }

        if (!orderToUpdate) {
            return message.reply('Không tìm thấy đơn hàng với Message ID này!');
        }

        try {
            // Lấy kênh chỉ định
            const targetChannel = await client.channels.fetch(orderToUpdate.channelId);
            console.log(`Lấy được kênh: ${targetChannel.id}`);

            // Lấy tin nhắn gốc
            const originalMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
            if (!originalMessage) {
                console.log(`Không tìm thấy tin nhắn với Message ID: ${messageId}`);
                return message.reply('Không tìm thấy tin nhắn với Message ID này để cập nhật!');
            }

            // Tạo embed mới với trạng thái "Đã hoàn thành"
            const updatedEmbed = new EmbedBuilder()
                .setTitle('DoA Store')
                .setAuthor({ name: 'DoA Store', iconURL: SMALL_ICON_URL }) // Hình nhỏ ở đầu
                .setDescription(`
                    ♥️ **ID Đơn:** ${orderIdToUpdate}  
                    💙 **Khách Hàng:** <@${orderToUpdate.customerId}>  
                    💛 **Ticket:** ${orderToUpdate.ticket}  
                    💚 **Thời Gian Lên Đơn:** ${orderToUpdate.createdAt}  
                    💜 **Trạng Thái:** Đã Hoàn Thành
                `)
                .setColor(colors[colorIndex])
                .setThumbnail(orderToUpdate.customerAvatar) // Giữ nguyên avatar khách hàng
                .setImage(LARGE_IMAGE_URL) // Hình lớn ở dưới
                .setFooter({ text: 'DoA Community' }); // Dòng bản quyền ở cuối

            // Chỉnh sửa tin nhắn gốc
            await originalMessage.edit({ embeds: [updatedEmbed] });
            console.log(`Đã cập nhật tin nhắn cho đơn hàng: ${orderIdToUpdate}`);

            // Xóa đơn hàng khỏi danh sách
            orders.delete(orderIdToUpdate);
            saveOrders(); // Lưu lại sau khi xóa
            console.log(`Đã xóa đơn hàng khỏi danh sách: ${orderIdToUpdate}`);

            // Phản hồi cho admin
            await message.reply(`Đã hoàn thành đơn hàng ${orderIdToUpdate}!`);

            // Đổi màu cho lần gửi tiếp theo
            colorIndex = (colorIndex + 1) % colors.length;

        } catch (error) {
            console.error(`Lỗi khi xử lý đơn hàng ${orderIdToUpdate}:`, error);
            await message.reply('Có lỗi xảy ra khi xử lý đơn hàng! Vui lòng kiểm tra log.');
        }
    }
});

client.login(TOKEN);
