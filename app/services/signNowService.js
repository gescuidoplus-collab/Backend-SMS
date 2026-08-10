import axios from 'axios';
import logger from '../config/logger.js';

const SIGNNOW_API_BASE = 'https://api.signnow.com';
const SIGNNOW_OAUTH_ENDPOINT = `${SIGNNOW_API_BASE}/oauth2/token`;

class SignNowService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.clientId = process.env.SIGNNOW_CLIENT_ID;
    this.clientSecret = process.env.SIGNNOW_CLIENT_SECRET;
    this.username = process.env.SIGNNOW_USERNAME;
    this.password = process.env.SIGNNOW_PASSWORD;
  }

  async getAccessToken() {
    // Si el token es válido, retornarlo
    if (this.accessToken && this.tokenExpiresAt > Date.now()) {
      logger.info('SignNow token reutilizado');
      return this.accessToken;
    }

    try {
      logger.info('Solicitando nuevo token OAuth2 a SignNow');

      const response = await axios.post(SIGNNOW_OAUTH_ENDPOINT, {
        grant_type: 'password',
        username: this.username,
        password: this.password,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer

      logger.info(`✓ Token OAuth2 obtenido correctamente. Expira en ${response.data.expires_in}s`);
      return this.accessToken;
    } catch (error) {
      logger.error('❌ Error obteniendo token OAuth2 de SignNow', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`SignNow OAuth error: ${error.message}`);
    }
  }

  async createDocumentFromTemplate(templateId, documentName) {
    const token = await this.getAccessToken();

    try {
      logger.info(`Creando documento a partir de template ${templateId}`, {
        documentName,
      });

      const response = await axios.post(
        `${SIGNNOW_API_BASE}/template/${templateId}/copy`,
        { document_name: documentName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const documentId = response.data.id;
      logger.info(`✓ Documento creado exitosamente`, {
        documentId,
        templateId,
      });

      // Obtener detalles del documento recién creado (roles)
      logger.info(`📋 Obteniendo detalles del documento ${documentId}`);
      const docDetailsResponse = await axios.get(
        `${SIGNNOW_API_BASE}/document/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        documentId,
        fields: docDetailsResponse.data.fields || [],
        roles: docDetailsResponse.data.roles || docDetailsResponse.data.signers || [],
        fullResponse: docDetailsResponse.data,
      };
    } catch (error) {
      logger.error('❌ Error creando documento desde template en SignNow', {
        templateId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to create document from template: ${error.message}`);
    }
  }

  async fillDocumentFields(documentId, fields) {
    const token = await this.getAccessToken();

    try {
      logger.info(`Llenando campos del documento ${documentId}`, {
        fieldCount: fields.length,
      });

      const response = await axios.put(
        `${SIGNNOW_API_BASE}/document/${documentId}`,
        { fields },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`✓ Campos del documento llenados correctamente`, {
        documentId,
      });

      return response.data;
    } catch (error) {
      logger.error('❌ Error llenando campos del documento en SignNow', {
        documentId,
        fieldCount: fields.length,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to fill document fields: ${error.message}`);
    }
  }

  async inviteToSign(documentId, signers, emailSubject, emailMessage) {
    const token = await this.getAccessToken();

    try {
      logger.info(`Invitando a firmar documento ${documentId}`, {
        signerCount: signers.length,
      });

      const payload = {
        to: signers.map((signer) => {
          const signerObj = { email: signer.email };
          if (signer.role_id) {
            signerObj.role_id = signer.role_id;
          }
          if (signer.role) {
            signerObj.role = signer.role;
          }
          return signerObj;
        }),
        from: this.username,
        subject: emailSubject,
        message: emailMessage,
      };

      const response = await axios.post(
        `${SIGNNOW_API_BASE}/document/${documentId}/freeform-invite`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`✓ Invitación de firma enviada correctamente`, {
        documentId,
        signerCount: signers.length,
      });

      return {
        invitationId: response.data.invitation_id,
        status: 'sent',
      };
    } catch (error) {
      logger.error('❌ Error invitando a firmar en SignNow', {
        documentId,
        signerCount: signers.length,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to send signature invitation: ${error.message}`);
    }
  }

  async getDocumentStatus(documentId) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${SIGNNOW_API_BASE}/document/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        documentId,
        status: response.data.status,
        signers: response.data.signers || [],
      };
    } catch (error) {
      logger.error('❌ Error obteniendo estado del documento en SignNow', {
        documentId,
        error: error.message,
      });
      throw new Error(`Failed to get document status: ${error.message}`);
    }
  }
}

export default new SignNowService();
