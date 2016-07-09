import api from '../services/api';
import types from '../constants/actionTypes';
import { takeEvery } from 'redux-saga';
import { select, take, takem, call, put } from 'redux-saga/effects'
import { BOARDS_PER_PAGE } from '../constants/config';
import { startProgressBar, stopProgressBar } from '../actions/progressBarActions';
import { hideModal } from '../actions/modalActions';
import {
  fetchBoards,
  fetchStarredBoards,
  fetchBoard,
  createBoard,
  removeBoard,
  updateBoard,
  moveBoard,
  setPageIndex,
  toggleStarred,
  addBoard,
} from '../actions/boardsActions';

function* fetchBoardsTask(action) {
  const { pageIndex } = action.payload;
  try {
    const payload = yield call(api.fetchBoards, pageIndex, BOARDS_PER_PAGE);
    yield put(fetchBoards.success({
      ...payload,
      request: {
        pageIndex,
      },
    }));
  } catch(err) {
    yield put(fetchBoards.failure(err.message));
  }
}

function* fetchStarredBoardsTask(action) {
  try {
    const payload = yield call(api.fetchStarredBoards);
    yield put(fetchStarredBoards.success(payload));
  } catch(err) {
    yield put(fetchStarredBoards.failure(err.message));
  }
}

function* fetchBoardsOnScroll() {
  const state = yield select(state => state);

  const { pathname } = state.routing.locationBeforeTransitions;
  const { ids, isFetching, pageIndex, isLastPage } = state.pages.main.all;

  const isCached = pageIndex * BOARDS_PER_PAGE < ids.length;

  if (pathname !== '/') {
    return;
  }

  if (isCached) {
    yield put(setPageIndex(pageIndex + 1));
    return;
  }

  if(!isFetching && !isLastPage) {
    yield put(fetchBoards.request({ pageIndex: pageIndex + 1 }));
  }
}

function* fetchBoardTask(action) {
  try {
    yield put(startProgressBar());
    const payload = yield call(api.fetchBoard, action.payload.id);
    yield put(fetchBoard.success(payload));
  } catch(err) {
    yield put(fetchBoard.failure(err.message));
  } finally {
    yield put(stopProgressBar());
  }
}

function* createBoardTask(action) {
  const { title, description } = action.payload;
  try {
    const payload = yield call(api.createBoard, title, description);
    yield put(createBoard.success(payload));
    yield put(hideModal());
    action.payload.resolve();
  } catch(err) {
    yield put(createBoard.failure(err.message));
    action.payload.reject();
  }
}

function* removeBoardTask(action) {
  try {
    const { isLastPage, ids } = yield select(state => state.pages.main.all);

    const payload = yield call(api.removeBoard, action.payload.id);

    if (!isLastPage) {
      // Figure out why ids.length is 15 not 16.
      const payload = yield call(api.fetchBoards, ids.length + 1, 1);

      // Sometimes displayed result is lags behind 1 item.
      yield put(addBoard(payload));
    }

    yield put(removeBoard.success(payload));
    yield put(hideModal());
  } catch(err) {
    yield put(removeBoard.failure(err.message)); 
  }
}

function* updateBoardTask(action) {
  const { id, props, params } = action.payload;
  try {
    const payload = yield call(api.updateBoard, id, props, params);
    yield put(updateBoard.success(payload));
  } catch(err) {
    yield put(updateBoard.failure(err.message));
  }
}

function* updateBoardModalFormTask(action) {
  const { id, props, resolve, reject } = action.payload;
  try {
    const payload = yield call(api.updateBoard, id, props);
    yield put(updateBoard.success(payload));
    yield put(hideModal());
    resolve();
  } catch(err) {
    yield put(updateBoard.failure(err.message));
    reject();
  }
}

function* moveBoardTask(action) {
  const { sourceId, targetId } = action.payload;
  try {
    const payload = yield call(api.moveBoard, sourceId, targetId);
    yield put(moveBoard.success(payload));
  } catch(err) {
    yield put(moveBoard.failure(err.message));
  }
}

function* toggleStarredTask(action) {
  const { id, starred } = action.payload;
  try {
    const payload = yield call(api.updateBoard, id, { starred }, {
      notify: false,
      activity: false,
    });
    yield put(toggleStarred.success(payload));
  } catch(err) {
    yield put(toggleStarred.failure(err.message));
  }
}

function* watchFetchBoards() {
  yield* takeEvery(types.BOARDS_FETCH_REQUEST, fetchBoardsTask);
}

function* watchFetchStarredBoards() {
  yield* takeEvery(types.BOARDS_FETCH_STARRED_REQUEST, fetchStarredBoardsTask);
}

function* watchFetchBoard() {
  yield* takeEvery(types.BOARD_FETCH_REQUEST, fetchBoardTask);
}

function* watchCreateBoard() {
  yield* takeEvery(types.BOARD_CREATE_REQUEST, createBoardTask);
}

function* watchRemoveBoard() {
  yield* takeEvery(types.BOARD_REMOVE_REQUEST, removeBoardTask);
}

function* watchUpdateBoard() {
  yield* takeEvery(types.BOARD_UPDATE_REQUEST, updateBoardTask);
}

function* watchUpdateBoardModalForm() {
  yield* takeEvery(types.BOARD_UPDATE_MODAL_FORM, updateBoardModalFormTask);
}

function* watchMoveBoard() {
  yield* takeEvery(types.BOARD_MOVE_REQUEST, moveBoardTask);
}

function* watchScrollBottom() {
  yield* takeEvery(types.SCROLL_BOTTOM, fetchBoardsOnScroll);
}

function* watchToggleStarred() {
  yield* takeEvery(types.BOARD_TOGGLE_STARRED_REQUEST, toggleStarredTask);
}

function* watchFetchAllAndStarred() {
  while (true) {
    for (let i = 0; i < 2; i++) {
      yield take([
        types.BOARDS_FETCH_REQUEST,
        types.BOARDS_FETCH_STARRED_REQUEST,
      ]);
    }

    yield put(startProgressBar());

    for (let i = 0; i < 2; i++) {
      yield take([
        types.BOARDS_FETCH_SUCCESS,
        types.BOARDS_FETCH_FAILURE,
        types.BOARDS_FETCH_STARRED_SUCCESS,
        types.BOARDS_FETCH_STARRED_FAILURE,
      ]);
    }

    yield put(stopProgressBar());
  }
}

export default function* boardsSaga() {
  yield [
    watchFetchBoards(),
    watchFetchStarredBoards(),
    watchFetchBoard(),
    watchCreateBoard(),
    watchRemoveBoard(),
    watchUpdateBoard(),
    watchMoveBoard(),
    watchUpdateBoardModalForm(),
    watchScrollBottom(),
    watchToggleStarred(),
    watchFetchAllAndStarred(),
  ];
}
