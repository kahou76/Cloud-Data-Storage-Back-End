    const AWS = require('aws-sdk');
    const express = require('express');
    const cors = require('cors');
    const app = express();

    //const s3 = new AWS.S3();
    app.use(cors());
    app.use(express.json());

    // configure the AWS SDK with access key and secret key
    AWS.config.update({
        accessKeyId: "AKIA474564FILNRCTPC6",
        secretAccessKey: "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",
        region: 'us-west-2'
    });

    // create an instance of the S3 class
    const s3 = new AWS.S3({ region: 'us-west-2' });

    const dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

    const docClient = new AWS.DynamoDB.DocumentClient({
        region: 'us-west-2', // replace with your region
        credentials: new AWS.SharedIniFileCredentials({ profile: 'default' }) // replace with your AWS credentials
      });

    // Load Data button handler
    app.post('/load-data', async (req, res) => {
    try {
        // Get object content from the URL
        const objectContent = await getObjectContentFromUrl('https://s3-us-west-2.amazonaws.com/css490/input.txt');

        // Save object to S3 bucket
        await saveObjectToBucket('prog4storagebucket', 'input.txt', objectContent);

        // Parse object content and save to DynamoDB table
        const items = parseObjectContent(objectContent);
        await saveItemsToDynamoDB('prog4database', items);

        res.status(200).send('Data loaded successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading data!');
    }
    });

    // Clear Data button handler
    app.post('/clear-data', async (req, res) => {
    try {
        // Delete object from S3 bucket
        await deleteObjectFromBucket('prog4storagebucket', 'input.txt');

        // Delete items from DynamoDB table
        await clearItemsFromDynamoDB('prog4database');

        res.status(200).send('Data cleared successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error clearing data!');
    }
    });

    // Query button handler
    app.post('/query', async (req, res) => {
    try {
        const firstName = req.body.firstName;
        const lastName = req.body.lastName;

        // Query items from DynamoDB table
        const items = await queryItemsFromDynamoDB('prog4database', firstName, lastName);

        res.status(200).send(items);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error querying data!');
    }
    });

    // Helper functions

    async function getObjectContentFromUrl(url) {
    const response = await fetch(url);
    const content = await response.text();
    return content;
    }

    async function saveObjectToBucket(bucketName, objectKey, objectContent) {
    const params = { Bucket: bucketName, Key: objectKey, Body: objectContent, ACL: 'public-read' };
    const result = await s3.putObject(params).promise();
    console.log(`Object saved to S3: s3://${bucketName}/${objectKey}`);
    }

    async function deleteObjectFromBucket(bucketName, objectKey) {
    const params = { Bucket: bucketName, Key: objectKey };
    const result = await s3.deleteObject(params).promise();
    console.log(`Object deleted from S3: s3://${bucketName}/${objectKey}`);
    }

    function parseObjectContent(objectContent) {
        if (!objectContent) {
            return [];
        }
        const items = [];
        const lines = objectContent.split('\n');
        for (const line of lines) {
          console.log(`Parsing line: ${line}`);
          const [fullName, ...properties] = line.trim().split(/\s+/);
          console.log(`Full name: ${fullName}`);
          console.log(`Properties: ${properties}`);
          const [lastName, firstName] = fullName.split(',');
          console.log(`Last name: ${lastName}`);
          console.log(`First name: ${firstName}`);
          const item = { lastName, firstName };
          for (const property of properties) {
            const [key, value] = property.split('=');
            console.log(`Key: ${key}`);
            console.log(`Value: ${value}`);
            item[key] = value;
          }
          console.log(`Parsed item: ${JSON.stringify(item)}`);
          items.push(item);
        }
        return items;
      }
      
      async function saveItemsToDynamoDB(items) {
        try {
          //const dynamodb = new AWS.DynamoDB();
          const tableName = 'prog4database';
          for (const item of items) {
            const params = {
              TableName: tableName,
              Item: {
                'id': { S: item.id },
              },
            };
      
            if (item.firstName) {
              params.Item.firstName = { S: item.firstName };
            }
      
            if (item.lastName) {
              params.Item.lastName = { S: item.lastName };
            }
      
            if (item.age) {
              params.Item.age = { N: item.age.toString() };
            }
      
            if (item.album) {
              params.Item.album = { S: item.album };
            }
      
            if (item.happy) {
              params.Item.happy = { BOOL: item.happy };
            }
      
            await dynamodb.putItem(params).promise();
          }
      
          console.log('Items saved to DynamoDB');
        } catch (err) {
          console.log(err);
        }
      }
      
      

      async function queryItemsFromDynamoDB(tableName, firstName, lastName) {
        const params = {
          TableName: tableName,
          IndexName: 'name-index',
          KeyConditionExpression: 'firstName = :firstName and lastName = :lastName',
          ExpressionAttributeValues: {
            ':firstName': firstName,
            ':lastName': lastName
          }
        };
        const result = await docClient.query(params).promise();
        const items = result.Items.map(item => ({
          name: item.name,
          properties: item.properties
        }));
        return items;
      }
      
      
      async function clearItemsFromDynamoDB(tableName) {
        const params = {
          TableName: tableName
        };
        const result = await docClient.scan(params).promise();
        const items = result.Items;
        for (const item of items) {
          const deleteParams = {
            TableName: tableName,
            Key: { name: item.name }
          };
          await docClient.delete(deleteParams).promise();
        }
      }
      
      

      function startServer() {
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
          console.log(`Server listening on port ${port}`);
        });
      }

    startServer();
      
      