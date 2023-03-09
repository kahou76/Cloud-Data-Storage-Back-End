const AWS = require('aws-sdk');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// configure the AWS SDK with access key and secret key
AWS.config.update({
  accessKeyId: 'AKIA474564FILNRCTPC6',
  secretAccessKey: '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',
  region: 'us-west-2'
});

// create an instance of the S3 class
const s3 = new AWS.S3();

const docClient = new AWS.DynamoDB.DocumentClient({
  region: 'us-west-2'
});

// Load Data button handler
app.post('/load', async (req, res) => {
  try {
    // Get object content from the URL
    const objectContent = await getObjectContentFromUrl('https://s3-us-west-2.amazonaws.com/css490/input.txt');

    // Save object to S3 bucket
    await saveObjectToBucket('prog4storagebucket', 'input.txt', objectContent);

    // Parse object content and save to DynamoDB table
    const items = parseObjectContent(objectContent);
    await saveItemsToDynamoDB('prog4database', items);

    res.status(200).send('Data loaded successfully!!!!!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading data!!!!!');
  }
});

// Clear Data button handler
app.post('/clear', async (req, res) => {
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
        const items = [];
        const lines = objectContent.split('\n');
        for (const line of lines) {
          const [lastName, firstName, ...properties] = line.trim().split(/\s+/);
          const item = { lastName, firstName };
          for (const property of properties) {
            const [key, value] = property.split('=');
            item[key] = value;
          }
          items.push(item);
        }
        return items;
      }
      
      async function saveItemsToDynamoDB(tableName, items) {
        const params = {
          TableName: tableName
        };
        for (const item of items) {
          const itemParams = {
            ...params,
            Item: {
              lastName: item.lastName,
              firstName: item.firstName
            }
          };
          for (const key in item) {
            if (key !== 'firstName' && key !== 'lastName') {
              itemParams.Item[key] = String(item[key]); // convert all attributes to String type
            }
          }
      
          // check if item already exists
          const existingItem = await docClient.get({
            TableName: tableName,
            Key: {
              lastName: item.lastName,
              firstName: item.firstName
            }
          }).promise();
      
          if (existingItem.Item) {
            // update existing item
            const updateParams = {
              TableName: tableName,
              Key: {
                lastName: item.lastName,
                firstName: item.firstName
              },
              AttributeUpdates: {}
            };
      
            for (const key in item) {
              if (key !== 'firstName' && key !== 'lastName') {
                updateParams.AttributeUpdates[key] = {
                  Action: 'PUT',
                  Value: String(item[key])
                };
              }
            }
      
            await docClient.update(updateParams).promise();
          } else {
            // create new item
            await docClient.put(itemParams).promise();
          }
        }
      }
      
      async function queryItemsFromDynamoDB(tableName, firstName, lastName) {
        console.log(`Querying items with first name: ${firstName} and last name: ${lastName}`);
      
        let params;
        if (firstName) {
          params = {
            TableName: tableName,
            KeyConditionExpression: 'lastName = :lastName and firstName = :firstName',
            ExpressionAttributeValues: {
              ':lastName': lastName,
              ':firstName': firstName,
            },
          };
        } else {
          params = {
            TableName: tableName,
            KeyConditionExpression: 'lastName = :lastName',
            ExpressionAttributeValues: {
              ':lastName': lastName,
            },
          };
        }
      
        console.log(`Query params: ${JSON.stringify(params)}`);
      
        const result = await docClient.query(params).promise();
      
        console.log(`Query result: ${JSON.stringify(result)}`);
      
        const items = result.Items.map((item) => {
          const itemProperties = {};
          for (const [key, value] of Object.entries(item)) {
            if (key !== 'lastName' && key !== 'firstName') {
              itemProperties[key] = value;
            }
          }
          return {
            name: `${item.firstName} ${item.lastName}`,
            properties: itemProperties,
          };
        });
      
        console.log(`Transformed items: ${JSON.stringify(items)}`);
      
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
            Key: {
              lastName: item.lastName,
              firstName: item.firstName
            }
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