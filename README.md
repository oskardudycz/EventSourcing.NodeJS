# EventSourcing.JS

## Resources

## Configuration

1. Install NodeJS - https://nodejs.org/en/download/. Recommended NVM.
2. Create project:
    ```bash
    npm init -y
    ```
3. [ExpressJS](https://expressjs.com/) - Web Server for REST API.
    - install:
    ```bash
    npm i express
    ```
4. [TypeScript](typescriptlang.org/) - We'll be doing Type Driven Development
    - install:
    ```bash
    npm i -D typescript @types/express @types/node
    ```
5. [ESLint](https://eslint.org) - We'd like to have static code analysis:
    - install using [npx](https://blog.npmjs.org/post/162869356040/introducing-npx-an-npm-package-runner) and going through wizard. This will generate install all packages and generate needed files (suggested is to use ECMA Modules, TypeScript, )
    ```bash
    npx eslint --init

    √ How would you like to use ESLint? · style       
    √ What type of modules does your project use? · esm
    √ Which framework does your project use? · none
    √ Does your project use TypeScript? · No / Yes
    √ Where does your code run? · node
    √ How would you like to define a style for your project? · guide
    √ Which style guide do you want to follow? · standard    
    √ What format do you want your config file to be in? · JSON
    ```
    - or using the `npm`:
    ```bash
    npm i -D @typescript-eslint/eslint-plugin eslint-config-standard eslint eslint-plugin-import eslint-plugin-node eslint-plugin-promise @typescript-eslint/parser
    ```
    - this should generate [.eslintrc.json`](./samples/simple/.eslintrc.json) file with ESLint configuration:
    ```json
    {
        "env": {
            "es2021": true,
            "node": true
        },
        "extends": [
            "standard"
        ],
        "parser": "@typescript-eslint/parser",
        "parserOptions": {
            "ecmaVersion": 12,
            "sourceType": "module"
        },
        "plugins": [
            "@typescript-eslint"
        ],
        "rules": {
        }
    }
    ```
    - add [.eslintignore`](./samples/simple/.eslintignore) to configure exclusion for files that we don't want to analyse:
    ```bash
    /node_modules/*
    
    # build artifacts
    dist/*coverage/*

    # data definition files
    **/*.d.ts

    # custom definition files
    /src/types/
    ```

6. Install Prettier, as we aim to write pretty code:
    ```bash
    npm i -D prettier eslint-config-prettier eslint-plugin-prettier
    ```
7. Install nodemon (to have hot reload of changes):

- [Sailesh Subramanian - Kickstart your Node-Typescript application with Express](https://medium.com/@saileshsubramanian7/kickstart-your-node-typescript-application-with-express-ddbc169128b3)
- [Robert Cooper - Using ESLint and Prettier in a TypeScript Project](https://robertcooper.me/post/using-eslint-and-prettier-in-a-typescript-project)