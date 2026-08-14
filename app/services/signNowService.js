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

  /**
   * Sube un PDF ya generado (relleno) a SignNow.
   */
  async uploadDocument(pdfBuffer, documentName) {
    const token = await this.getAccessToken();

    try {
      logger.info(`Subiendo documento a SignNow`, { documentName });

      const form = new FormData();
      form.append(
        'file',
        new Blob([pdfBuffer], { type: 'application/pdf' }),
        `${documentName}.pdf`
      );

      const response = await axios.post(`${SIGNNOW_API_BASE}/document`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });

      logger.info(`✓ Documento subido correctamente`, {
        documentId: response.data.id,
      });

      return response.data.id;
    } catch (error) {
      logger.error('❌ Error subiendo documento a SignNow', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }

  /**
   * Añade los campos de firma al documento. SignNow crea automáticamente los
   * roles a partir del campo `role` de cada firma.
   */
  async addSignatureFields(documentId, firmas) {
    const token = await this.getAccessToken();

    try {
      const fields = firmas.map((firma, index) => ({
        page_number: 0,
        type: 'signature',
        name: `Signature ${index + 1}`,
        role: firma.role,
        required: true,
        x: firma.x,
        y: firma.y,
        width: firma.width,
        height: firma.height,
      }));

      await axios.put(
        `${SIGNNOW_API_BASE}/document/${documentId}`,
        { fields },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Releemos el documento para obtener los role_id que SignNow acaba de crear
      const doc = await axios.get(`${SIGNNOW_API_BASE}/document/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      logger.info(`✓ Campos de firma añadidos`, {
        documentId,
        roles: (doc.data.roles || []).map((r) => r.name),
      });

      return doc.data.roles || [];
    } catch (error) {
      logger.error('❌ Error añadiendo campos de firma en SignNow', {
        documentId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to add signature fields: ${error.message}`);
    }
  }

  /**
   * Crea invitaciones embebidas (sin envío de correo) y devuelve un link de
   * firma por cada rol.
   */
  async createSigningLinks(documentId, roles, linkExpirationMinutes = 45) {
    const token = await this.getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const invites = roles.map((role, index) => ({
        // SignNow exige un email en el payload aunque no envía ningún correo
        // en las invitaciones embebidas; usamos un placeholder interno.
        email: `firmante${index + 1}@cuidofam.local`,
        role_id: role.unique_id,
        order: 1,
        auth_method: 'none',
      }));

      const inviteResponse = await axios.post(
        `${SIGNNOW_API_BASE}/v2/documents/${documentId}/embedded-invites`,
        { invites },
        { headers }
      );

      const links = [];
      for (const invite of inviteResponse.data?.data || []) {
        const linkResponse = await axios.post(
          `${SIGNNOW_API_BASE}/v2/documents/${documentId}/embedded-invites/${invite.id}/link`,
          { auth_method: 'none', link_expiration: linkExpirationMinutes },
          { headers }
        );

        const role = roles.find((r) => r.unique_id === invite.role_id);
        links.push({
          role: role?.name || 'Firmante',
          link: linkResponse.data?.data?.link,
        });
      }

      logger.info(`✓ Links de firma generados`, {
        documentId,
        linkCount: links.length,
      });

      return links;
    } catch (error) {
      logger.error('❌ Error generando links de firma en SignNow', {
        documentId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to create signing links: ${error.message}`);
    }
  }

  async downloadDocument(documentId, type = 'collapsed') {
    const token = await this.getAccessToken();

    try {
      logger.info(`Descargando documento ${documentId}`, { type });

      const response = await axios.get(
        `${SIGNNOW_API_BASE}/document/${documentId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { type },
          responseType: 'arraybuffer',
        }
      );

      logger.info(`✓ Documento descargado correctamente`, { documentId });

      return response.data;
    } catch (error) {
      logger.error('❌ Error descargando documento de SignNow', {
        documentId,
        error: error.message,
      });
      throw new Error(`Failed to download document: ${error.message}`);
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
