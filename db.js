import mysql from 'mysql2/promise'
import dbconfig from './dbconfig.json' with { type: 'json' }
const pool = mysql.createPool(dbconfig)

const getConnection = async () => {
    try {
        const connection = await pool.getConnection()
        return connection
    }
    catch (error) {
        console.error('Error getting MySQL connection:', error)
        throw error
    }
}

//  EXAMPLE FUNCTION BELOW 
const getUsers = async () => {
    try {
        const connection = await getConnection()
        const sql = `
                    SELECT customer.name AS 'customer',
                    system_user.id AS 'id',
                    system_user.fullname AS 'full name',
                    system_user.email AS 'email',
                    CASE 
                        WHEN system_user.admin = 0 THEN 'false'
                        ELSE 'true'
                    END AS 'admin'
                    FROM customer
                    RIGHT JOIN system_user
                    ON customer.id = system_user.customer_id
                    `
        const [users] = await connection.execute(sql)
        connection.release()
        return users
    } catch (error) {
        console.error('Error getting users:', error)
        throw error
    }
}

export default {
    getUsers
}