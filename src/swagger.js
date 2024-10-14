import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: {
    title: 'Cognito Bughunt Teste',
    description: 'Documentação Cognito Bughunt Teste'
  },
  schemes: ['http', 'https']
};

const outputFile = './swagger-output.json';
const routes = ['./routes.js'];

/* NOTE: If you are using the express Router, you must pass in the 'routes' only the 
root file where the route starts, such as index.js, app.js, routes.js, etc ... */

swaggerAutogen()(outputFile, routes, doc);