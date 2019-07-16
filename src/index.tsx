import React, { useState, useEffect, useMemo, useCallback } from "react"
import { css } from "emotion"
import semver from "semver"
import uniq from "lodash.uniq"
import { render } from "react-dom"
import prettyBytes from "pretty-bytes"

const FAKE_SEP = "___FAKE_SEP___"

function getPkgsFromUrl() {
	let found = window.location.search
		.replace(/^\?/, "")
		.split("&")
		.map(part => part.split("="))
		.find(part => part[0] === "pkgs")

	if (found) return found[1]
	return null
}

let INITIAL_QUERY = getPkgsFromUrl() || "react+react-dom,preact,inferno"

function toItems(input: string) {
	return uniq(input.split(/[ ,]+/).filter(item => item !== "")).map(item =>
		item.split("+"),
	)
}

function stringifyItems(items: string[][]) {
	return items.map(pkgs => pkgs.join("+")).join(", ")
}

function App() {
	let [input, setInput] = useState(stringifyItems(toItems(INITIAL_QUERY)))

	let [responses, setResponses] = useState<{ [key: string]: any }>({})

	let handleChangeInput = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setInput(event.currentTarget.value)
		},
		[],
	)

	let items = useMemo(() => toItems(input), [input])

	useEffect(() => {
		window.history.replaceState(
			{},
			"",
			window.location.pathname +
				"?pkgs=" +
				items.map(pkgs => pkgs.join("+")).join(","),
		)
	}, [items])

	useEffect(() => {
		let controller = new AbortController()

		for (let pkgs of items) {
			for (let pkg of pkgs) {
				if (responses[pkg]) continue

				fetch(`https://bundlephobia.com/api/package-history?package=${pkg}`, {
					signal: controller.signal,
				})
					.then(res => res.json())
					.then(json => {
						setResponses(responses => ({ ...responses, [pkg]: json }))
					})
					.catch(err => {
						console.error(err)
					})
			}
		}

		return () => controller.abort()
	}, [items])

	function getSize(pkgs: string[]) {
		let min = 0
		let gzip = 0

		for (let pkg of pkgs) {
			let response = responses[pkg]
			if (!response) return null

			let versions = Object.keys(response).filter(version => {
				return Object.keys(response[version]).length !== 0
			})

			let highest = semver.maxSatisfying(versions, "x.x.x")
			if (!highest) return null

			let data = response[highest]
			if (!data) return null

			min += data.size
			gzip += data.gzip
		}

		return { min, gzip }
	}

	let pkgsWithSizes = items
		.map(pkgs => {
			return {
				pkgs: pkgs,
				size: getSize(pkgs),
			}
		})
		.filter(item => {
			return item.size
		})
		.sort((a: any, b: any) => {
			return a.size.gzip - b.size.gzip
		})

	return (
		<div className={styles.app}>
			<input
				className={styles.input}
				value={input}
				onChange={handleChangeInput}
			/>
			<table className={styles.table}>
				<thead>
					<tr>
						<th>Package(s)</th>
						<th>Size (min)</th>
						<th>Size (min+gzip)</th>
					</tr>
				</thead>
				<tbody>
					{pkgsWithSizes.map((item: any) => {
						return (
							<tr key={item.pkgs.join("+")}>
								<td>{item.pkgs.join("+")}</td>
								<td align="right">{prettyBytes(item.size.min)}</td>
								<td align="right">{prettyBytes(item.size.gzip)}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

let styles = {
	app: css`
		padding: 2em;
	`,
	input: css`
		font: inherit;
		padding: 0.5em;
		width: 100%;
		margin-bottom: 2em;
	`,
	table: css`
		width: 100%;
		table-layout: fixed;
		border-spacing: 0;

		th,
		td {
			padding: 1em;
		}

		tr:nth-child(odd) td {
			background: #eee;
		}
	`,
}

render(<App />, document.getElementById("root"))
