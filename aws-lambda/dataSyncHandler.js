/**
 * AWS Lambda Function Template - Data Sync
 * 
 * Deploy this to AWS Lambda to sync health data with DynamoDB.
 * 
 * SETUP:
 * 1. Create a DynamoDB table named 'HealthTrackerData' with:
 *    - Partition key: userId (String)
 *    - Sort key: dataType#timestamp (String)
 * 2. Create a Lambda function with this code
 * 3. Attach IAM role with DynamoDB read/write permissions
 * 4. Create an API Gateway trigger with Cognito authorizer
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'HealthTrackerData';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Get user ID from Cognito
  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const method = event.httpMethod;
  const path = event.path || event.rawPath || '';

  try {
    // POST /sync - Upload data to cloud
    if (method === 'POST' && path.endsWith('/sync')) {
      const body = JSON.parse(event.body || '{}');
      const { weights, measurements, zepboundShots, profile } = body;
      
      const items = [];
      const timestamp = new Date().toISOString();

      // Prepare weight entries
      if (weights?.length) {
        for (const w of weights) {
          items.push({
            PutRequest: {
              Item: {
                userId,
                sortKey: `weight#${w.date}`,
                dataType: 'weight',
                data: w,
                updatedAt: timestamp,
              },
            },
          });
        }
      }

      // Prepare measurements
      if (measurements?.length) {
        for (const m of measurements) {
          items.push({
            PutRequest: {
              Item: {
                userId,
                sortKey: `measurement#${m.date}`,
                dataType: 'measurement',
                data: m,
                updatedAt: timestamp,
              },
            },
          });
        }
      }

      // Prepare Zepbound shots
      if (zepboundShots?.length) {
        for (const s of zepboundShots) {
          items.push({
            PutRequest: {
              Item: {
                userId,
                sortKey: `zepbound#${s.date}`,
                dataType: 'zepbound',
                data: s,
                updatedAt: timestamp,
              },
            },
          });
        }
      }

      // Prepare nutrition data
      if (body.nutrition?.length) {
        for (const n of body.nutrition) {
          items.push({
            PutRequest: {
              Item: {
                userId,
                sortKey: `nutrition#${n.date}`,
                dataType: 'nutrition',
                data: n,
                updatedAt: timestamp,
              },
            },
          });
        }
      }

      // Save profile
      if (profile) {
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            userId,
            sortKey: 'profile#current',
            dataType: 'profile',
            data: profile,
            updatedAt: timestamp,
          },
        }));
      }

      // Batch write all items (DynamoDB allows 25 items per batch)
      if (items.length > 0) {
        const batches = [];
        for (let i = 0; i < items.length; i += 25) {
          batches.push(items.slice(i, i + 25));
        }

        for (const batch of batches) {
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: batch,
            },
          }));
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          itemsSynced: items.length + (profile ? 1 : 0),
        }),
      };
    }

    // GET /sync - Download data from cloud
    if (method === 'GET' && path.endsWith('/sync')) {
      const since = event.queryStringParameters?.since || '';
      
      // Query all user data
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': userId,
        },
      }));

      const items = result.Items || [];
      
      // Filter by date if 'since' provided
      const filteredItems = since 
        ? items.filter(item => item.updatedAt > since)
        : items;

      // Organize by type
      const weights = filteredItems
        .filter(item => item.dataType === 'weight')
        .map(item => item.data);
      
      const measurements = filteredItems
        .filter(item => item.dataType === 'measurement')
        .map(item => item.data);
      
      const zepboundShots = filteredItems
        .filter(item => item.dataType === 'zepbound')
        .map(item => item.data);
      
      const nutrition = filteredItems
        .filter(item => item.dataType === 'nutrition')
        .map(item => item.data);
      
      const profile = filteredItems
        .find(item => item.dataType === 'profile')?.data || null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          weights,
          measurements,
          zepboundShots,
          nutrition,
          profile,
        }),
      };
    }

    // DELETE /sync - Delete all user data
    if (method === 'DELETE' && path.endsWith('/sync')) {
      // Query all user items
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': userId,
        },
        ProjectionExpression: 'userId, sortKey',
      }));

      const items = result.Items || [];
      
      // Delete in batches
      const deleteRequests = items.map(item => ({
        DeleteRequest: {
          Key: {
            userId: item.userId,
            sortKey: item.sortKey,
          },
        },
      }));

      for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        }));
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          itemsDeleted: items.length,
        }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' }),
    };

  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
