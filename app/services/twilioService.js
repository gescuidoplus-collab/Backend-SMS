import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

export const sendGroupMessage = async (message, numbers) => {
    try {
        const promises = numbers.map(number =>
            client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: `whatsapp:${number}`
            })
        );

        const results = await Promise.allSettled(promises);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Error al enviar a ${numbers[index]}:`, result.reason);
            }
        });

        return results;
    } catch (error) {
        console.error('Error catastrófico en Twilio:', error);
        throw error;
    }
};