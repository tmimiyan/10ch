/**
 * ==========================================================
 * OpenBBS API
 * Version 0.1.0
 * ==========================================================
 */

import { CONFIG, API } from "./config.js";

/**
 * API Base Class
 */
class Provider {

    async getThreads() {

        throw new Error("Not Implemented");

    }

}

/**
 * GitHub Provider
 */
class GitHubProvider extends Provider {

    constructor() {

        super();

        this.baseURL =
            `${API.github}/repos/${CONFIG.github.owner}/${CONFIG.github.repo}`;

    }

    /**
     * スレッド一覧取得
     */
    async getThreads() {

        const url =
            `${this.baseURL}/issues?state=open&per_page=${CONFIG.pagination.pageSize}`;

        try {

            const response =
                await fetch(url);

            if (!response.ok) {

                throw new Error(
                    `GitHub Error : ${response.status}`
                );

            }

            const issues =
                await response.json();

            return issues.map(issue => ({

                id: issue.number,

                title: issue.title,

                body: issue.body,

                author: issue.user.login,

                avatar: issue.user.avatar_url,

                created:

                    issue.created_at,

                updated:

                    issue.updated_at,

                comments:

                    issue.comments,

                url:

                    issue.html_url,

                locked:

                    issue.locked,

                labels:

                    issue.labels

            }));

        }

        catch (error) {

            console.error(error);

            return [];

        }

    }

    /**
     * スレ取得
     */

    async getThread(id){

        const response =
            await fetch(
                `${this.baseURL}/issues/${id}`
            );

        return await response.json();

    }

    /**
     * レス取得
     */

    async getComments(id){

        const response =
            await fetch(
                `${this.baseURL}/issues/${id}/comments`
            );

        return await response.json();

    }

}

/**
 * API Class
 */

class OpenBBSAPI {

    constructor(provider){

        this.provider = provider;

    }

    getThreads(){

        return this.provider.getThreads();

    }

    getThread(id){

        return this.provider.getThread(id);

    }

    getComments(id){

        return this.provider.getComments(id);

    }

}

/**
 * Export
 */

export const api =
    new OpenBBSAPI(
        new GitHubProvider()
    );