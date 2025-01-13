import React from "react";

class Navbar extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            token: localStorage.getItem("token"),
        };
    }

    handleLogout = () => {
        localStorage.removeItem("token");
        this.setState({ token: null });
        window.location.href = "/auth/sign_in";
    };
    handleLogin = () => {
        window.location.href = "/auth/sign_in";
    };
    render() {
        return (
            <nav className="navbar">
                <ul className="navbar-items">
                    <li className="navbar-item">
                        <a href="/tasks">My Tasks</a>
                    </li>
                    <li className="navbar-item">
                        <a href="/projects">My Projects</a>
                    </li>
                </ul>
                {this.state.token !== null ? (
                    <button className="logout-btn btn" onClick={this.handleLogout}>Log Out</button>
                ) : (
                    <button className="login-btn btn" onClick={this.handleLogin}>Log In</button>
                )}
            </nav>
        );
    }
}

export default Navbar;
