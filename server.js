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
        const items = await parseObjectContent(objectContent);
        for (const item of items) {
          const { LastName, FirstName } = item;
          const tableName = getTableName(LastName.S, FirstName.S);

          try {
            // Check if table already exists
            await dynamodb.describeTable({ TableName: tableName }).promise();
            console.log(`Table already exists: ${tableName}`);
          } catch (err) {
            // Create table if it doesn't exist
            if (err.code === 'ResourceNotFoundException') {
              await dynamodb.createTable({
                TableName: tableName,
                KeySchema: [
                  { AttributeName: 'LastName', KeyType: 'HASH' },
                  { AttributeName: 'FirstName', KeyType: 'RANGE' }
                ],
                AttributeDefinitions: [
                  { AttributeName: 'LastName', AttributeType: 'S' },
                  { AttributeName: 'FirstName', AttributeType: 'S' }
                ],
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
              }).promise();
              console.log(`Table created: ${tableName}`);
            } else {
              // Table already exists, do nothing
              console.log(`Table already exists: ${tableName}`);
            }
          }

          // Check if item already exists in the table
          const existingItem = await dynamodb.getItem({
            TableName: tableName,
            Key: {
              LastName: { S: LastName.S },
              FirstName: { S: FirstName.S }
            }
          }).promise();

          if (existingItem.Item) {
            console.log(`Item already exists in table ${tableName}:`, existingItem.Item);
          } else {
            await saveItemsToDynamoDB(tableName, [item]);
          }
        }

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
      await s3.headObject(params).promise().catch((err) => {
        console.log(`Object s3://${bucketName}/${objectKey} does not exist`);
        throw err;
      });
      const result = await s3.deleteObject(params).promise();
      console.log(`Object deleted from S3: s3://${bucketName}/${objectKey}`);
    }
    
    async function doesTableExist(tableName) {
      try {
        await dynamodb.describeTable({TableName: tableName}).promise();
        return true;
      } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
          return false;
        }
        throw error;
      }
    }

    async function parseObjectContent(objectContent) {
      const items = objectContent.split('\n').map(item => {
        const [lastName, firstName, ...attributes] = item.split(' ');
        const itemObject = {};
        itemObject['LastName'] = { S: lastName };
        itemObject['FirstName'] = { S: firstName };
        attributes.forEach(attribute => {
          const [key, value] = attribute.split('=');
          itemObject[key] = { S: value };
        });
        return itemObject;
      });
      return items;
    }
    
    async function saveItemsToDynamoDB(tableName, items) {
      const params = {
        RequestItems: {
          [tableName]: items.map(item => ({ PutRequest: { Item: item } }))
        }
      };
      await dynamodb.batchWriteItem(params).promise();
      console.log(`Items saved to DynamoDB table: ${tableName}`);
    }
    
    function getTableName(lastName, firstName) {
      return `${lastName.toLowerCase()}${firstName.toLowerCase()}`;
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
      
      