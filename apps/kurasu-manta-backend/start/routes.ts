/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const ChatsController = () => import('#controllers/chats_controller')

router.get('/chat', [ChatsController, 'index'])
router.post('/chat', [ChatsController, 'chat'])
