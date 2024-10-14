import express from 'express';
import AWS from 'aws-sdk';
import jwkToPem from 'jwk-to-pem';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

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
  console.log('Healthy!!!')
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
  const { token } = req.query;
  console.log('🚀 ~ file: routes.js:100 ~ routes.post ~ req:', req);
  console.log('🚀 ~ file: routes.js:100 ~ routes.post ~ token:', token);
  try {
    const decodedToken = jwt.decode(token, {complete: true});
    if (!decodedToken) {
      throw new Error('Token Inválido')
    }

    const { kid } = decodedToken.header;

    const jwksUrl = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_USER_POOL_ID}/.well-known/jwks.json`;
    const response = await fetch(jwksUrl);
    const jwks = await response.json();

    // 3. Encontre a chave correspondente ao kid
    const key = jwks.keys.find(k => k.kid === kid);
    if (!key) {
      throw new Error('Chave pública não encontrada');
    }

     // 4. Converta a chave JWK para PEM
     const pem = jwkToPem(key);

     // 5. Verifique o token
     const verifiedToken = jwt.verify(token, pem, { algorithms: ['RS256'] });
     console.log('🚀 ~ file: routes.js:125 ~ routes.post ~ verifiedToken:', verifiedToken);
 
     // 6. Verifique os claims do token
     if (verifiedToken.token_use !== 'id') {
       throw new Error('Token não é um token de identificação');
     }
 
     // Verifique se o token não está expirado
     const currentTime = Math.floor(Date.now() / 1000);
     if (currentTime > verifiedToken.exp) {
       throw new Error('Token expirado');
     }
 
     // Verifique o emissor do token
     const issuer = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_USER_POOL_ID}`;
     if (verifiedToken.iss !== issuer) {
       throw new Error('Emissor inválido');
     }
 
     // 7. Token é válido
     console.log('Token válido!!!');
     return verifiedToken;
 
  } catch(error) {
    console.error(error.message)
    res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
})

routes.get('/api/auth/list', async (req, res) => {
  const result = await cognito.listUserPoolClients({
    UserPoolId: process.env.AWS_USER_POOL_ID,
  });

  return result;
})

export default routes;