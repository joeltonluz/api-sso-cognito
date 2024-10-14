const express = require('express');
const AWS = require('aws-sdk');

const routes = express.Router();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.AWS_REGION
});

routes.get('/', (req,res) => {
  return res.status(200).send('Healthy')
})

routes.post("/api/auth/create-idp", async (req, res) => {
  const { providerName, metadataUrl } = req.body;
  try {
    const params = {
      UserPoolId: process.env.AWS_USER_POOL_ID,
      ProviderName: providerName, // Nome do seu provedor SAML
      ProviderType: "SAML",
      ProviderDetails: {
        MetadataURL: metadataUrl,
        // OU use MetadataFile se você tiver o arquivo de metadados localmente
        // MetadataFile: 'conteúdo-base64-do-arquivo-de-metadados',
      },
      // AttributeMapping: {
      //   'email': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      //   'given_name': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
      //   'family_name': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
      //   // Adicione outros mapeamentos conforme necessário
      // },
      IdpIdentifiers: [
        providerName, // Identificador único para este IdP, pode ser o mesmo que ProviderName
      ],
    };

    const result = await cognito.createIdentityProvider(params).promise();
    console.log('IdP SAML criado com sucesso:', result);

    const resultUpdate = await cognito.updateUserPoolClient({
      UserPoolId: process.env.AWS_USER_POOL_ID,
      ClientId: process.env.AWS_CLIENT_ID,
      SupportedIdentityProviders: [providerName],
      // AllowedOAuthFlows: ["implicit"],
      // AllowedOAuthScopes: ["openid", "email", "profile"],
    }).promise();
    return resultUpdate;
  } catch (error) {
    console.error('Erro ao criar IdP SAML:', error);
    res.status(500).json({ error: 'Erro ao criar IDP' });
  }
});

routes.post('/api/auth/get-idp-url', async (req, res) => {
  const { email } = req.body;
  const userPoolId = process.env.AWS_USER_POOL_ID;
  const clientId = process.env.AWS_CLIENT_ID;

  try {
    const params = {
      UserPoolId: userPoolId,
      AttributesToGet: ['email'],
      Filter: `email = "${email}"`
    };

    const { Users } = await cognito.listUsers(params).promise();
    console.log('🚀 ~ file: routes.js:32 ~ routes.post ~ Users:', JSON.stringify(Users));

    if (Users && Users.length > 0) {
      const user = Users[0];
      if (!user.Enabled)
        res.status(404).json({ error: 'Usuário inativo' });

      console.log('🚀 ~file: routes.js:69 ~ routes.post ~ user:', user);
      // Aqui você precisaria ter uma lógica para mapear o usuário ao IDP correto
      const idpName = user.Username.split('_')[0]; // Exemplo
      const idpUrl = `https://cogbughunt.auth.us-east-2.amazoncognito.com/oauth2/authorize?identity_provider=${idpName}&redirect_uri=https://jwt.io&response_type=token&client_id=${clientId}&scope=email+openid+profile`;

      res.json({ idpUrl });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao buscar usuário:', error.message);
    res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
});

routes.post('/api/auth/validate-token', async (req, res) => {

})

routes.get('/api/auth/list', async (req, res) => {
  const result = await cognito.listUserPoolClients({
    UserPoolId: process.env.AWS_USER_POOL_ID,
  });

  return result;
})

module.exports = routes;